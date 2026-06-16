import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunityAccessMode,
  ContentVisibility,
  FriendRequestStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { defer, from, interval, merge, Observable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityMessagesRealtimeService } from './community-messages-realtime.service';
import { PrivateMessagesRealtimeService } from './private-messages-realtime.service';
import { PostCommentsRealtimeService } from './post-comments-realtime.service';
import { SocialNotificationsRealtimeService } from './social-notifications-realtime.service';
import {
  ApplyOpportunityDto,
  CreateBenefitDto,
  CreateCommunityDto,
  CreateCommunityMessageDto,
  CreateEventDto,
  CreateOpportunityDto,
  CreatePostCommentDto,
  CreatePostDto,
  CreatePostReactionDto,
  CreatePrivateMessageDto,
  FriendRequestResponseDto,
  JoinCommunityDto,
  ListPostCommentsQueryDto,
  ListCommunityMessagesQueryDto,
  ListPublicContentQueryDto,
  SocialTargetDto,
  UpdateBenefitDto,
  UpdateCommunityDto,
  UpdateCommunityMessageDto,
  UpdateEventDto,
  UpdateOpportunityDto,
  UpdatePostCommentDto,
  UpdatePostDto,
} from './dto/social-content.dto';

type Pagination = {
  page: number;
  limit: number;
  skip: number;
};

const COMMUNITY_SECRET_HASH_ROUNDS = 12;
const POST_REACTION_TYPES = ['like', 'love', 'fire', 'clap'] as const;
const POST_REACTION_LABELS: Record<PostReactionType, string> = {
  like: 'curtiu',
  love: 'amou',
  fire: 'destacou',
  clap: 'aplaudiu',
};

type PostReactionType = (typeof POST_REACTION_TYPES)[number];
type ReactionSummary = Record<PostReactionType, number>;
type RecentPostReaction = {
  user: string;
  userId: string;
  reaction: PostReactionType;
  at: string;
};
type PostReactionMetadata = {
  reactionSummary: ReactionSummary;
  selectedReaction: PostReactionType | '';
  recentReactions: RecentPostReaction[];
};

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communityMessagesRealtime: CommunityMessagesRealtimeService,
    private readonly privateMessagesRealtime: PrivateMessagesRealtimeService,
    private readonly postCommentsRealtime: PostCommentsRealtimeService,
    private readonly socialNotificationsRealtime: SocialNotificationsRealtimeService,
  ) {}

  async createPost(tenantId: string, authorId: string, dto: CreatePostDto) {
    if (dto.sharedFromPostId) {
      await this.ensurePublicPost(dto.sharedFromPostId);
    }

    return this.prisma.withTenant(tenantId, (tx) =>
      tx.post.create({
        data: {
          ...this.sanitizePostCreate(dto),
          tenantId,
          authorId,
          visibility: ContentVisibility.PUBLIC,
        },
        include: this.postInclude(),
      }),
    );
  }

  async getSocialGraph(user: AuthenticatedUser) {
    return this.prisma.withPlatformAdmin((tx) => this.buildSocialGraph(tx, user.sub));
  }

  streamSocialNotifications(user: AuthenticatedUser): Observable<MessageEvent> {
    return merge(
      this.socialNotificationsRealtime.stream(user.sub).pipe(
        map((event) => ({
          data: event,
        })),
      ),
      interval(25_000).pipe(
        map(() => ({
          data: {
            kind: 'keepalive',
            recipientId: user.sub,
            at: new Date().toISOString(),
          },
        })),
      ),
    );
  }

  async followUser(user: AuthenticatedUser, dto: SocialTargetDto) {
    await this.assertDifferentUsers(user.sub, dto.targetUserId);
    await this.prisma.withPlatformAdmin(async (tx) => {
      const [actor, target] = await Promise.all([
        this.requireActiveUser(tx, user.sub),
        this.requireActiveUser(tx, dto.targetUserId),
      ]);
      this.assertSameTenant(actor.tenantId, target.tenantId);

      const existing = await tx.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: user.sub,
            followingId: dto.targetUserId,
          },
        },
        select: { id: true },
      });

      if (existing) return;

      await tx.userFollow.create({
        data: {
          tenantId: actor.tenantId,
          followerId: user.sub,
          followingId: dto.targetUserId,
        },
      });
      await this.createSocialNotification(tx, {
        tenantId: actor.tenantId,
        recipientId: dto.targetUserId,
        actorId: user.sub,
        type: 'social-follow',
        title: `${actor.name || 'Um membro'} começou a seguir você.`,
      });
    });

    return this.getSocialGraph(user);
  }

  async unfollowUser(user: AuthenticatedUser, targetUserId: string) {
    await this.assertDifferentUsers(user.sub, targetUserId);
    await this.prisma.withPlatformAdmin(async (tx) => {
      await tx.userFollow.deleteMany({
        where: {
          followerId: user.sub,
          followingId: targetUserId,
        },
      });
    });

    return this.getSocialGraph(user);
  }

  async requestFriendship(user: AuthenticatedUser, dto: SocialTargetDto) {
    await this.assertDifferentUsers(user.sub, dto.targetUserId);
    await this.prisma.withPlatformAdmin(async (tx) => {
      const [actor, target] = await Promise.all([
        this.requireActiveUser(tx, user.sub),
        this.requireActiveUser(tx, dto.targetUserId),
      ]);
      this.assertSameTenant(actor.tenantId, target.tenantId);

      const accepted = await tx.friendRequest.findFirst({
        where: {
          status: FriendRequestStatus.ACCEPTED,
          OR: [
            { requesterId: user.sub, recipientId: dto.targetUserId },
            { requesterId: dto.targetUserId, recipientId: user.sub },
          ],
        },
        select: { id: true },
      });
      if (accepted) return;

      const reversePending = await tx.friendRequest.findUnique({
        where: {
          requesterId_recipientId: {
            requesterId: dto.targetUserId,
            recipientId: user.sub,
          },
        },
      });
      if (reversePending?.status === FriendRequestStatus.PENDING) {
        await this.acceptFriendRequest(tx, actor.tenantId, dto.targetUserId, user.sub);
        return;
      }

      await tx.friendRequest.upsert({
        where: {
          requesterId_recipientId: {
            requesterId: user.sub,
            recipientId: dto.targetUserId,
          },
        },
        create: {
          tenantId: actor.tenantId,
          requesterId: user.sub,
          recipientId: dto.targetUserId,
          status: FriendRequestStatus.PENDING,
        },
        update: {
          status: FriendRequestStatus.PENDING,
          respondedAt: null,
        },
      });
      await this.createSocialNotification(tx, {
        tenantId: actor.tenantId,
        recipientId: dto.targetUserId,
        actorId: user.sub,
        type: 'friend-request',
        title: `${actor.name || 'Um membro'} enviou uma solicitação de amizade.`,
      });
    });

    return this.getSocialGraph(user);
  }

  async respondFriendRequest(
    user: AuthenticatedUser,
    requesterId: string,
    dto: FriendRequestResponseDto,
  ) {
    await this.assertDifferentUsers(user.sub, requesterId);
    await this.prisma.withPlatformAdmin(async (tx) => {
      const [actor, requester] = await Promise.all([
        this.requireActiveUser(tx, user.sub),
        this.requireActiveUser(tx, requesterId),
      ]);
      this.assertSameTenant(actor.tenantId, requester.tenantId);

      const existing = await tx.friendRequest.findUnique({
        where: {
          requesterId_recipientId: {
            requesterId,
            recipientId: user.sub,
          },
        },
      });
      if (!existing || existing.status !== FriendRequestStatus.PENDING) {
        throw new NotFoundException('Friend request not found');
      }

      if (dto.accepted) {
        await this.acceptFriendRequest(tx, actor.tenantId, requesterId, user.sub);
      } else {
        await tx.friendRequest.update({
          where: { id: existing.id },
          data: {
            status: FriendRequestStatus.REJECTED,
            respondedAt: new Date(),
          },
        });
      }

      await this.createSocialNotification(tx, {
        tenantId: actor.tenantId,
        recipientId: requesterId,
        actorId: user.sub,
        type: dto.accepted ? 'friend-accepted' : 'friend-rejected',
        title: dto.accepted
          ? `${actor.name || 'Um membro'} aceitou sua solicitação de amizade.`
          : `${actor.name || 'Um membro'} recusou sua solicitação de amizade.`,
      });
    });

    return this.getSocialGraph(user);
  }

  async listPosts(query: ListPublicContentQueryDto, user?: AuthenticatedUser) {
    const { page, limit, skip } = this.pagination(query);
    const search = query.search?.trim();
    const where: Prisma.PostWhereInput = {
      visibility: ContentVisibility.PUBLIC,
      ...(query.city?.trim()
        ? { city: { equals: query.city.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.category?.trim()
        ? { tag: { equals: query.category.trim(), mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              { body: { contains: search, mode: 'insensitive' } },
              { tag: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { author: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.withPlatformAdmin(async (tx) => {
      const [posts, count] = await Promise.all([
        tx.post.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: this.postInclude(),
        }),
        tx.post.count({ where }),
      ]);
      return [
        await this.withPostReactionMetadata(tx, posts, user?.sub),
        count,
      ] as const;
    });

    return this.page(data, total, page, limit);
  }

  async getPost(id: string, user?: AuthenticatedUser) {
    const post = await this.prisma.withPlatformAdmin((tx) =>
      tx.post.findFirst({
        where: {
          id,
          visibility: ContentVisibility.PUBLIC,
        },
        include: {
          ...this.postInclude(),
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: this.publicUserSelect() } },
          },
        },
      }),
    );
    if (!post) throw new NotFoundException('Post not found');
    const [enrichedPost] = await this.prisma.withPlatformAdmin((tx) =>
      this.withPostReactionMetadata(tx, [post], user?.sub),
    );
    return enrichedPost;
  }

  async updatePost(id: string, user: AuthenticatedUser, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    this.assertOwnerOrAdmin(post.authorId, user);

    return this.prisma.post.update({
      where: { id },
      data: this.sanitizePostUpdate(dto),
      include: this.postInclude(),
    });
  }

  async deletePost(id: string, user: AuthenticatedUser) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    this.assertOwnerOrAdmin(post.authorId, user);
    await this.prisma.post.delete({ where: { id } });
    return { deleted: true };
  }

  async commentPost(
    tenantId: string,
    postId: string,
    authorId: string,
    dto: CreatePostCommentDto,
  ) {
    await this.ensurePublicPost(postId);
    const comment = await this.prisma.postComment.create({
      data: {
        postId,
        tenantId,
        authorId,
        body: this.sanitizeRequiredText(dto.body, 'body'),
      },
      include: this.postCommentInclude(),
    });
    this.postCommentsRealtime.publish({
      postId,
      kind: 'comment.created',
      comment,
    });
    return comment;
  }

  async listPostComments(
    postId: string,
    query: ListPostCommentsQueryDto,
  ) {
    await this.ensurePublicPost(postId);
    const limit = query.limit ?? 100;
    const comments = await this.prisma.withPlatformAdmin(async (tx) => {
      const data = await tx.postComment.findMany({
        where: { postId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: this.postCommentInclude(),
      });
      return data.reverse();
    });
    return { data: comments };
  }

  streamPostComments(postId: string): Observable<MessageEvent> {
    return defer(() =>
      from(this.ensurePublicPost(postId)).pipe(
        mergeMap(() =>
          merge(
            this.postCommentsRealtime.stream(postId).pipe(
              map((event) => ({
                data: event,
              })),
            ),
            interval(25_000).pipe(
              map(() => ({
                data: {
                  kind: 'keepalive',
                  postId,
                  at: new Date().toISOString(),
                },
              })),
            ),
          ),
        ),
      ),
    );
  }

  async updatePostComment(
    postId: string,
    commentId: string,
    user: AuthenticatedUser,
    dto: UpdatePostCommentDto,
  ) {
    const existing = await this.prisma.postComment.findFirst({
      where: { id: commentId, postId },
      select: { id: true, authorId: true },
    });
    if (!existing) throw new NotFoundException('Post comment not found');
    this.assertOwnerOrAdmin(existing.authorId, user);

    const comment = await this.prisma.postComment.update({
      where: { id: commentId },
      data: { body: this.sanitizeRequiredText(dto.body, 'body') },
      include: this.postCommentInclude(),
    });
    this.postCommentsRealtime.publish({
      postId,
      kind: 'comment.updated',
      comment,
    });
    return comment;
  }

  async deletePostComment(
    postId: string,
    commentId: string,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.postComment.findFirst({
      where: { id: commentId, postId },
      select: { id: true, authorId: true },
    });
    if (!existing) throw new NotFoundException('Post comment not found');
    this.assertOwnerOrAdmin(existing.authorId, user);

    await this.prisma.postComment.delete({ where: { id: commentId } });
    this.postCommentsRealtime.publish({
      postId,
      kind: 'comment.deleted',
      commentId,
    });
    return { deleted: true, id: commentId };
  }

  async reactPost(
    tenantId: string,
    postId: string,
    userId: string,
    dto: CreatePostReactionDto,
  ) {
    const reactionType = this.sanitizePostReactionType(dto.type);
    return this.prisma.withPlatformAdmin(async (tx) => {
      const [post, actor] = await Promise.all([
        tx.post.findFirst({
          where: { id: postId, visibility: ContentVisibility.PUBLIC },
          select: {
            id: true,
            tenantId: true,
            authorId: true,
            body: true,
          },
        }),
        tx.user.findFirst({
          where: {
            id: userId,
            status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'PAYMENT_PROCESSING'] },
          },
          select: { id: true, name: true },
        }),
      ]);
      if (!post) throw new NotFoundException('Post not found');
      if (!actor) throw new ForbiddenException('User is not active');

      const existing = await tx.postReaction.findUnique({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
        select: { id: true, type: true },
      });

      if (existing?.type === reactionType) {
        await tx.postReaction.delete({ where: { id: existing.id } });
      } else if (existing) {
        await tx.postReaction.update({
          where: { id: existing.id },
          data: { type: reactionType },
        });
      } else {
        await tx.postReaction.create({
          data: {
            postId,
            tenantId: post.tenantId || tenantId,
            userId,
            type: reactionType,
          },
        });
      }

      if (existing?.type !== reactionType) {
        await this.createSocialNotification(tx, {
          tenantId: post.tenantId || tenantId,
          recipientId: post.authorId,
          actorId: userId,
          type: 'post-reaction',
          title: `${actor.name || 'Um membro'} ${POST_REACTION_LABELS[reactionType]} sua publicação.`,
          metadata: { postId, reaction: reactionType },
        });
      }

      const updatedPost = await tx.post.findFirstOrThrow({
        where: { id: postId },
        include: this.postInclude(),
      });
      const [enrichedPost] = await this.withPostReactionMetadata(tx, [updatedPost], userId);
      return enrichedPost;
    });
  }

  async listPrivateConversations(user: AuthenticatedUser) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const conversations = await tx.privateConversation.findMany({
        where: {
          OR: [{ firstUserId: user.sub }, { secondUserId: user.sub }],
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: this.privateConversationInclude(),
      });
      const unreadCounts = await this.getPrivateUnreadCounts(
        tx,
        conversations.map((conversation) => conversation.id),
        user.sub,
      );
      return conversations.map((conversation) =>
        this.mapPrivateConversation(conversation, user.sub, unreadCounts),
      );
    });
  }

  async startPrivateConversation(user: AuthenticatedUser, dto: SocialTargetDto) {
    await this.assertDifferentUsers(user.sub, dto.targetUserId);
    return this.prisma.withPlatformAdmin(async (tx) => {
      const [actor, target] = await Promise.all([
        this.requireActiveUser(tx, user.sub),
        this.requireActiveUser(tx, dto.targetUserId),
      ]);
      this.assertSameTenant(actor.tenantId, target.tenantId);
      const [firstUserId, secondUserId] = this.orderPrivateConversationUsers(
        user.sub,
        dto.targetUserId,
      );

      const conversation = await tx.privateConversation.upsert({
        where: {
          firstUserId_secondUserId: {
            firstUserId,
            secondUserId,
          },
        },
        create: {
          tenantId: actor.tenantId,
          firstUserId,
          secondUserId,
        },
        update: {},
        include: this.privateConversationInclude(),
      });

      return this.mapPrivateConversation(conversation, user.sub, new Map());
    });
  }

  async listPrivateMessages(
    conversationId: string,
    user: AuthenticatedUser,
    query: ListCommunityMessagesQueryDto,
  ) {
    const limit = query.limit ?? 100;
    return this.prisma.withPlatformAdmin(async (tx) => {
      await this.ensurePrivateConversationAccess(tx, conversationId, user.sub);
      await tx.privateMessage.updateMany({
        where: {
          conversationId,
          senderId: { not: user.sub },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      const messages = await tx.privateMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: this.privateMessageInclude(),
      });
      return {
        data: messages
          .reverse()
          .map((message) => this.mapPrivateMessage(message, user.sub)),
      };
    });
  }

  streamPrivateMessages(
    conversationId: string,
    user: AuthenticatedUser,
  ): Observable<MessageEvent> {
    return defer(() =>
      from(
        this.prisma.withPlatformAdmin((tx) =>
          this.ensurePrivateConversationAccess(tx, conversationId, user.sub),
        ),
      ).pipe(
        mergeMap(() =>
          merge(
            this.privateMessagesRealtime.stream(conversationId).pipe(
              map((event) => ({
                data: event,
              })),
            ),
            interval(25_000).pipe(
              map(() => ({
                data: {
                  kind: 'keepalive',
                  conversationId,
                  at: new Date().toISOString(),
                },
              })),
            ),
          ),
        ),
      ),
    );
  }

  async createPrivateMessage(
    conversationId: string,
    user: AuthenticatedUser,
    dto: CreatePrivateMessageDto,
  ) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const conversation = await this.ensurePrivateConversationAccess(
        tx,
        conversationId,
        user.sub,
      );
      const recipientId = this.getPrivateConversationRecipient(conversation, user.sub);
      const message = await tx.privateMessage.create({
        data: {
          conversationId,
          tenantId: conversation.tenantId,
          senderId: user.sub,
          body: this.sanitizeRequiredText(dto.body, 'body'),
        },
        include: this.privateMessageInclude(),
      });
      await tx.privateConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      await this.createSocialNotification(tx, {
        tenantId: conversation.tenantId,
        recipientId,
        actorId: user.sub,
        type: 'private-message',
        title: `${message.sender.name || 'Um membro'} enviou uma mensagem privada.`,
        metadata: { conversationId },
      });
      this.privateMessagesRealtime.publish({
        conversationId,
        kind: 'message.created',
        message,
      });
      return this.mapPrivateMessage(message, user.sub);
    });
  }

  async createCommunity(
    tenantId: string,
    ownerId: string,
    dto: CreateCommunityDto,
  ) {
    const access = await this.prepareCommunityAccess(dto);
    const community = await this.prisma.withTenant(tenantId, (tx) =>
      tx.community.create({
        data: {
          name: this.sanitizeRequiredText(dto.name, 'name'),
          topic: this.sanitizeOptionalText(dto.topic),
          description: this.sanitizeOptionalText(dto.description),
          city: this.sanitizeOptionalText(dto.city),
          imageUrl: dto.imageUrl,
          tenantId,
          ownerId,
          visibility: ContentVisibility.PUBLIC,
          accessMode: access.accessMode,
          passwordHash: access.passwordHash,
          inviteCodeHash: access.inviteCodeHash,
          members: {
            create: { tenantId, userId: ownerId, role: 'OWNER' },
          },
          memberCount: 1,
        },
        select: this.communitySelect(ownerId),
      }),
    );
    return this.mapCommunityForUser(community);
  }

  async listCommunities(
    query: ListPublicContentQueryDto,
    user?: AuthenticatedUser,
  ) {
    const { page, limit, skip } = this.pagination(query);
    const search = query.search?.trim();
    const where: Prisma.CommunityWhereInput = {
      visibility: ContentVisibility.PUBLIC,
      ...(query.city?.trim()
        ? { city: { equals: query.city.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.category?.trim()
        ? { topic: { equals: query.category.trim(), mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { topic: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.withPlatformAdmin((tx) =>
      Promise.all([
        tx.community.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: this.communitySelect(user?.sub),
        }),
        tx.community.count({ where }),
      ]),
    );
    return this.page(
      data.map((community) => this.mapCommunityForUser(community)),
      total,
      page,
      limit,
    );
  }

  async getCommunity(id: string, user?: AuthenticatedUser) {
    const community = await this.prisma.withPlatformAdmin((tx) =>
      tx.community.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        select: this.communitySelect(user?.sub),
      }),
    );
    if (!community) throw new NotFoundException('Community not found');
    return this.mapCommunityForUser(community);
  }

  async updateCommunity(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateCommunityDto,
  ) {
    const community = await this.prisma.community.findUnique({ where: { id } });
    if (!community) throw new NotFoundException('Community not found');
    this.assertOwnerOrAdmin(community.ownerId, user);
    const access = await this.prepareCommunityAccess(dto, {
      accessMode: community.accessMode,
      passwordHash: community.passwordHash,
      inviteCodeHash: community.inviteCodeHash,
    });
    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        ...(dto.name !== undefined
          ? { name: this.sanitizeRequiredText(dto.name, 'name') }
          : {}),
        ...(dto.topic !== undefined
          ? { topic: this.sanitizeOptionalText(dto.topic) }
          : {}),
        ...(dto.description !== undefined
          ? { description: this.sanitizeOptionalText(dto.description) }
          : {}),
        ...(dto.city !== undefined
          ? { city: this.sanitizeOptionalText(dto.city) }
          : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        accessMode: access.accessMode,
        passwordHash: access.passwordHash,
        inviteCodeHash: access.inviteCodeHash,
      },
      select: this.communitySelect(user.sub),
    });
    return this.mapCommunityForUser(updated);
  }

  async deleteCommunity(id: string, user: AuthenticatedUser) {
    const community = await this.prisma.community.findUnique({ where: { id } });
    if (!community) throw new NotFoundException('Community not found');
    this.assertOwnerOrAdmin(community.ownerId, user);
    await this.prisma.community.delete({ where: { id } });
    return { deleted: true };
  }

  async joinCommunity(
    communityId: string,
    userId: string,
    dto: JoinCommunityDto = {},
  ) {
    return this.prisma.withPlatformAdmin(async (tx) => {
      const community = await tx.community.findFirst({
        where: { id: communityId, visibility: ContentVisibility.PUBLIC },
        select: {
          id: true,
          tenantId: true,
          accessMode: true,
          passwordHash: true,
          inviteCodeHash: true,
        },
      });
      if (!community) throw new NotFoundException('Community not found');

      const existingMembership = await tx.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId } },
      });
      if (existingMembership) return existingMembership;

      await this.assertCommunityCanBeJoined(community, dto);

      const membership = await tx.communityMember.upsert({
        where: { communityId_userId: { communityId, userId } },
        create: { communityId, tenantId: community.tenantId, userId },
        update: {},
      });
      const memberCount = await tx.communityMember.count({
        where: { communityId },
      });
      await tx.community.update({
        where: { id: communityId },
        data: { memberCount },
      });
      return membership;
    });
  }

  async listCommunityMessages(
    communityId: string,
    user: AuthenticatedUser,
    query: ListCommunityMessagesQueryDto,
  ) {
    const limit = query.limit ?? 100;
    const data = await this.prisma.withPlatformAdmin(async (tx) => {
      await this.assertCommunityMember(tx, communityId, user.sub);
      const messages = await tx.communityMessage.findMany({
        where: { communityId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: this.communityMessageSelect(),
      });
      return messages.reverse();
    });
    return { data: data.map((message) => this.mapCommunityMessage(message, user)) };
  }

  streamCommunityMessages(
    communityId: string,
    user: AuthenticatedUser,
  ): Observable<MessageEvent> {
    return defer(() =>
      from(
        this.prisma.withPlatformAdmin((tx) =>
          this.assertCommunityMember(tx, communityId, user.sub),
        ),
      ),
    ).pipe(
      mergeMap(() =>
        merge(
          this.communityMessagesRealtime.stream(communityId).pipe(
            map((event) => ({
              id: event.message.id,
              data: {
                kind: event.kind,
                message: this.mapCommunityMessage(event.message, user),
              },
            })),
          ),
          interval(25_000).pipe(
            map(() => ({
              data: {
                kind: 'keepalive',
                communityId,
                at: new Date().toISOString(),
              },
            })),
          ),
        ),
      ),
    );
  }

  async createCommunityMessage(
    communityId: string,
    user: AuthenticatedUser,
    dto: CreateCommunityMessageDto,
  ) {
    const message = await this.prisma.withPlatformAdmin(async (tx) => {
      const community = await this.assertCommunityMember(tx, communityId, user.sub);
      return tx.communityMessage.create({
        data: {
          communityId,
          tenantId: community.tenantId,
          authorId: user.sub,
          body: this.sanitizeRequiredText(dto.body, 'body'),
        },
        select: this.communityMessageSelect(),
      });
    });
    this.communityMessagesRealtime.publish({
      communityId,
      kind: 'message.created',
      message,
    });
    return this.mapCommunityMessage(message, user);
  }

  async updateCommunityMessage(
    communityId: string,
    messageId: string,
    user: AuthenticatedUser,
    dto: UpdateCommunityMessageDto,
  ) {
    const message = await this.prisma.withPlatformAdmin(async (tx) => {
      await this.assertCommunityMember(tx, communityId, user.sub);
      const existing = await tx.communityMessage.findFirst({
        where: { id: messageId, communityId },
        select: { id: true, authorId: true, deletedAt: true },
      });
      if (!existing || existing.deletedAt) {
        throw new NotFoundException('Community message not found');
      }
      if (existing.authorId !== user.sub) {
        throw new ForbiddenException('Only the author can edit this message');
      }
      return tx.communityMessage.update({
        where: { id: messageId },
        data: {
          body: this.sanitizeRequiredText(dto.body, 'body'),
          editedAt: new Date(),
        },
        select: this.communityMessageSelect(),
      });
    });
    this.communityMessagesRealtime.publish({
      communityId,
      kind: 'message.updated',
      message,
    });
    return this.mapCommunityMessage(message, user);
  }

  async deleteCommunityMessage(
    communityId: string,
    messageId: string,
    user: AuthenticatedUser,
  ) {
    const message = await this.prisma.withPlatformAdmin(async (tx) => {
      const membership = await this.assertCommunityMember(tx, communityId, user.sub);
      const existing = await tx.communityMessage.findFirst({
        where: { id: messageId, communityId },
        select: { id: true, authorId: true, deletedAt: true },
      });
      if (!existing || existing.deletedAt) {
        throw new NotFoundException('Community message not found');
      }
      const isAuthor = existing.authorId === user.sub;
      const isAdmin =
        membership.role === 'OWNER' ||
        membership.role === 'ADMIN' ||
        user.role === UserRole.ADMIN ||
        Boolean(user.platformRole);
      if (!isAuthor && !isAdmin) {
        throw new ForbiddenException('Only the author or an admin can delete this message');
      }
      return tx.communityMessage.update({
        where: { id: messageId },
        data: {
          deletedAt: new Date(),
          deletedById: user.sub,
          deletedByAdmin: !isAuthor && isAdmin,
          body: '',
        },
        select: this.communityMessageSelect(),
      });
    });
    this.communityMessagesRealtime.publish({
      communityId,
      kind: 'message.deleted',
      message,
    });
    return this.mapCommunityMessage(message, user);
  }

  createOpportunity(
    tenantId: string,
    ownerId: string,
    dto: CreateOpportunityDto,
  ) {
    return this.prisma.opportunity.create({
      data: {
        ...dto,
        tenantId,
        ownerId,
        visibility: ContentVisibility.PUBLIC,
      },
      include: this.opportunityInclude(),
    });
  }

  async listOpportunities(query: ListPublicContentQueryDto) {
    const { page, limit, skip } = this.pagination(query);
    const search = query.search?.trim();
    const where: Prisma.OpportunityWhereInput = {
      visibility: ContentVisibility.PUBLIC,
      ...(query.city?.trim()
        ? { city: { equals: query.city.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.category?.trim()
        ? { category: { equals: query.category.trim(), mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { company: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.withPlatformAdmin((tx) =>
      Promise.all([
        tx.opportunity.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: this.opportunityInclude(),
        }),
        tx.opportunity.count({ where }),
      ]),
    );
    return this.page(data, total, page, limit);
  }

  async getOpportunity(id: string) {
    const opportunity = await this.prisma.withPlatformAdmin((tx) =>
      tx.opportunity.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        include: this.opportunityInclude(),
      }),
    );
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    return opportunity;
  }

  async updateOpportunity(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateOpportunityDto,
  ) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    this.assertOwnerOrAdmin(opportunity.ownerId, user);
    return this.prisma.opportunity.update({
      where: { id },
      data: dto,
      include: this.opportunityInclude(),
    });
  }

  async deleteOpportunity(id: string, user: AuthenticatedUser) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    this.assertOwnerOrAdmin(opportunity.ownerId, user);
    await this.prisma.opportunity.delete({ where: { id } });
    return { deleted: true };
  }

  async applyOpportunity(
    tenantId: string,
    opportunityId: string,
    userId: string,
    dto: ApplyOpportunityDto,
  ) {
    await this.ensurePublicOpportunity(opportunityId);
    return this.prisma.opportunityApplication.upsert({
      where: { opportunityId_userId: { opportunityId, userId } },
      create: { ...dto, opportunityId, tenantId, userId },
      update: dto,
    });
  }

  createBenefit(tenantId: string, ownerId: string, dto: CreateBenefitDto) {
    return this.prisma.benefit.create({
      data: {
        ...dto,
        pointsCost: dto.pointsCost ?? 0,
        tenantId,
        ownerId,
        visibility: ContentVisibility.PUBLIC,
      },
      include: this.benefitInclude(),
    });
  }

  async listBenefits(query: ListPublicContentQueryDto) {
    const { page, limit, skip } = this.pagination(query);
    const search = query.search?.trim();
    const where: Prisma.BenefitWhereInput = {
      visibility: ContentVisibility.PUBLIC,
      ...(query.city?.trim()
        ? { city: { equals: query.city.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.category?.trim()
        ? { category: { equals: query.category.trim(), mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { partner: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.withPlatformAdmin((tx) =>
      Promise.all([
        tx.benefit.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: this.benefitInclude(),
        }),
        tx.benefit.count({ where }),
      ]),
    );
    return this.page(data, total, page, limit);
  }

  async getBenefit(id: string) {
    const benefit = await this.prisma.withPlatformAdmin((tx) =>
      tx.benefit.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        include: this.benefitInclude(),
      }),
    );
    if (!benefit) throw new NotFoundException('Benefit not found');
    return benefit;
  }

  async updateBenefit(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateBenefitDto,
  ) {
    const benefit = await this.prisma.benefit.findUnique({ where: { id } });
    if (!benefit) throw new NotFoundException('Benefit not found');
    this.assertOwnerOrAdmin(benefit.ownerId, user);
    return this.prisma.benefit.update({
      where: { id },
      data: dto,
      include: this.benefitInclude(),
    });
  }

  async deleteBenefit(id: string, user: AuthenticatedUser) {
    const benefit = await this.prisma.benefit.findUnique({ where: { id } });
    if (!benefit) throw new NotFoundException('Benefit not found');
    this.assertOwnerOrAdmin(benefit.ownerId, user);
    await this.prisma.benefit.delete({ where: { id } });
    return { deleted: true };
  }

  async redeemBenefit(tenantId: string, benefitId: string, userId: string) {
    await this.ensurePublicBenefit(benefitId);
    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.benefitRedemption.upsert({
        where: { benefitId_userId: { benefitId, userId } },
        create: { benefitId, tenantId, userId },
        update: {},
      });
      const redemptionCount = await tx.benefitRedemption.count({
        where: { benefitId },
      });
      await tx.benefit.update({
        where: { id: benefitId },
        data: { redemptionCount },
      });
      return redemption;
    });
  }

  createEvent(tenantId: string, ownerId: string, dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        priceCents: dto.priceCents ?? 0,
        tenantId,
        ownerId,
        visibility: ContentVisibility.PUBLIC,
      },
      include: this.eventInclude(),
    });
  }

  async listEvents(query: ListPublicContentQueryDto) {
    const { page, limit, skip } = this.pagination(query);
    const search = query.search?.trim();
    const where: Prisma.EventWhereInput = {
      visibility: ContentVisibility.PUBLIC,
      ...(query.city?.trim()
        ? { location: { contains: query.city.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.category?.trim()
        ? { mode: { equals: query.category.trim(), mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { organizer: { contains: search, mode: 'insensitive' } },
              { mode: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.withPlatformAdmin((tx) =>
      Promise.all([
        tx.event.findMany({
          where,
          orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
          skip,
          take: limit,
          include: this.eventInclude(),
        }),
        tx.event.count({ where }),
      ]),
    );
    return this.page(data, total, page, limit);
  }

  async getEvent(id: string) {
    const event = await this.prisma.withPlatformAdmin((tx) =>
      tx.event.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        include: this.eventInclude(),
      }),
    );
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async updateEvent(id: string, user: AuthenticatedUser, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    this.assertOwnerOrAdmin(event.ownerId, user);
    return this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      },
      include: this.eventInclude(),
    });
  }

  async deleteEvent(id: string, user: AuthenticatedUser) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    this.assertOwnerOrAdmin(event.ownerId, user);
    await this.prisma.event.delete({ where: { id } });
    return { deleted: true };
  }

  async registerEvent(tenantId: string, eventId: string, userId: string) {
    await this.ensurePublicEvent(eventId);
    return this.prisma.eventRegistration.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, tenantId, userId },
      update: {},
    });
  }

  private pagination(query: ListPublicContentQueryDto): Pagination {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    return { page, limit, skip: (page - 1) * limit };
  }

  private page<T>(data: T[], total: number, page: number, limit: number) {
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private assertOwnerOrAdmin(ownerId: string, user: AuthenticatedUser) {
    if (
      user.sub === ownerId ||
      user.role === UserRole.ADMIN ||
      Boolean(user.platformRole)
    ) {
      return;
    }
    throw new ForbiddenException('Only the owner or an admin can change this content');
  }

  private assertDifferentUsers(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('Target user must be different from current user');
    }
  }

  private assertSameTenant(currentTenantId: string, targetTenantId: string) {
    if (currentTenantId !== targetTenantId) {
      throw new ForbiddenException('Social interaction is restricted to the current tenant');
    }
  }

  private requireActiveUser(tx: Prisma.TransactionClient, userId: string) {
    return tx.user.findFirstOrThrow({
      where: {
        id: userId,
        status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'PAYMENT_PROCESSING'] },
      },
      select: this.socialUserSelect(),
    });
  }

  private async createSocialNotification(
    tx: Prisma.TransactionClient,
    data: {
      tenantId: string;
      recipientId: string;
      actorId?: string;
      type: string;
      title: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    if (data.recipientId === data.actorId) return null;
    const notification = await tx.socialNotification.create({
      data: {
        tenantId: data.tenantId,
        recipientId: data.recipientId,
        actorId: data.actorId,
        type: data.type,
        title: data.title,
        metadata: data.metadata,
      },
      include: { actor: { select: this.socialUserSelect() } },
    });
    this.socialNotificationsRealtime.publish({
      recipientId: data.recipientId,
      kind: 'notification.created',
      notification: this.mapSocialNotification(notification),
    });
    return notification;
  }

  private async acceptFriendRequest(
    tx: Prisma.TransactionClient,
    tenantId: string,
    requesterId: string,
    recipientId: string,
  ) {
    await tx.friendRequest.update({
      where: {
        requesterId_recipientId: {
          requesterId,
          recipientId,
        },
      },
      data: {
        status: FriendRequestStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    await Promise.all([
      tx.userFollow.upsert({
        where: {
          followerId_followingId: {
            followerId: requesterId,
            followingId: recipientId,
          },
        },
        create: { tenantId, followerId: requesterId, followingId: recipientId },
        update: {},
      }),
      tx.userFollow.upsert({
        where: {
          followerId_followingId: {
            followerId: recipientId,
            followingId: requesterId,
          },
        },
        create: { tenantId, followerId: recipientId, followingId: requesterId },
        update: {},
      }),
    ]);
  }

  private async buildSocialGraph(tx: Prisma.TransactionClient, userId: string) {
    const user = await this.requireActiveUser(tx, userId);
    const [
      following,
      followers,
      sentRequests,
      incomingRequests,
      acceptedRequests,
      notifications,
      followersCount,
      followingCount,
      friendsCount,
    ] = await Promise.all([
      tx.userFollow.findMany({
        where: { followerId: userId },
        orderBy: { createdAt: 'desc' },
        include: { following: { select: this.socialUserSelect() } },
        take: 500,
      }),
      tx.userFollow.findMany({
        where: { followingId: userId },
        orderBy: { createdAt: 'desc' },
        include: { follower: { select: this.socialUserSelect() } },
        take: 500,
      }),
      tx.friendRequest.findMany({
        where: { requesterId: userId, status: FriendRequestStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        include: { recipient: { select: this.socialUserSelect() } },
        take: 500,
      }),
      tx.friendRequest.findMany({
        where: { recipientId: userId, status: FriendRequestStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        include: { requester: { select: this.socialUserSelect() } },
        take: 500,
      }),
      tx.friendRequest.findMany({
        where: {
          status: FriendRequestStatus.ACCEPTED,
          OR: [{ requesterId: userId }, { recipientId: userId }],
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          requester: { select: this.socialUserSelect() },
          recipient: { select: this.socialUserSelect() },
        },
        take: 500,
      }),
      tx.socialNotification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: this.socialUserSelect() } },
        take: 100,
      }),
      tx.userFollow.count({ where: { followingId: userId } }),
      tx.userFollow.count({ where: { followerId: userId } }),
      tx.friendRequest.count({
        where: {
          status: FriendRequestStatus.ACCEPTED,
          OR: [{ requesterId: userId }, { recipientId: userId }],
        },
      }),
    ]);

    const followingProfiles = following.map((item) => this.mapSocialUser(item.following));
    const followerProfiles = followers.map((item) => this.mapSocialUser(item.follower));
    const sentProfiles = sentRequests.map((item) => this.mapSocialUser(item.recipient));
    const incomingProfiles = incomingRequests.map((item) => this.mapSocialUser(item.requester));
    const friendProfiles = acceptedRequests.map((item) =>
      this.mapSocialUser(item.requesterId === userId ? item.recipient : item.requester),
    );
    const profiles = this.uniqueSocialProfiles([
      ...followingProfiles,
      ...followerProfiles,
      ...sentProfiles,
      ...incomingProfiles,
      ...friendProfiles,
      ...notifications.map((notice) =>
        notice.actor ? this.mapSocialUser(notice.actor) : null,
      ),
    ]);

    return {
      currentUser: this.mapSocialUser(user),
      profiles,
      followingHandles: followingProfiles.map((profile) => profile.handle),
      followerHandles: followerProfiles.map((profile) => profile.handle),
      sentFriendRequestHandles: sentProfiles.map((profile) => profile.handle),
      incomingFriendRequestHandles: incomingProfiles.map((profile) => profile.handle),
      friendHandles: friendProfiles.map((profile) => profile.handle),
      blockedHandles: [],
      followerDeltas: {},
      stats: {
        followers: followersCount,
        following: followingCount,
        friends: friendsCount,
      },
      notifications: notifications.map((notice) =>
        this.mapSocialNotification(notice),
      ),
    };
  }

  private mapSocialNotification(notification: {
    id: string;
    title: string;
    read: boolean;
    type: string;
    createdAt: Date;
    metadata?: Prisma.JsonValue | null;
    actor?: Parameters<SocialService['mapSocialUser']>[0] | null;
  }) {
    const actor = notification.actor ? this.mapSocialUser(notification.actor) : null;
    return {
      id: notification.id,
      title: notification.title,
      channel: 'computador',
      read: notification.read,
      type: notification.type,
      actorHandle: actor?.handle ?? '',
      createdAt: notification.createdAt,
      metadata: notification.metadata ?? undefined,
      actor,
    };
  }

  private orderPrivateConversationUsers(firstUserId: string, secondUserId: string) {
    return [firstUserId, secondUserId].sort() as [string, string];
  }

  private async getPrivateUnreadCounts(
    tx: Prisma.TransactionClient,
    conversationIds: string[],
    userId: string,
  ) {
    if (!conversationIds.length) return new Map<string, number>();
    const counts = await tx.privateMessage.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        readAt: null,
      },
      _count: { _all: true },
    });
    return new Map(counts.map((item) => [item.conversationId, item._count._all]));
  }

  private async ensurePrivateConversationAccess(
    tx: Prisma.TransactionClient,
    conversationId: string,
    userId: string,
  ) {
    const conversation = await tx.privateConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ firstUserId: userId }, { secondUserId: userId }],
      },
      include: {
        firstUser: { select: this.socialUserSelect() },
        secondUser: { select: this.socialUserSelect() },
      },
    });
    if (!conversation) throw new NotFoundException('Private conversation not found');
    return conversation;
  }

  private getPrivateConversationRecipient(
    conversation: { firstUserId: string; secondUserId: string },
    senderId: string,
  ) {
    return conversation.firstUserId === senderId
      ? conversation.secondUserId
      : conversation.firstUserId;
  }

  private mapPrivateConversation(
    conversation: {
      id: string;
      firstUserId: string;
      secondUserId: string;
      updatedAt: Date;
      firstUser: Parameters<SocialService['mapSocialUser']>[0];
      secondUser: Parameters<SocialService['mapSocialUser']>[0];
      messages?: Array<Parameters<SocialService['mapPrivateMessage']>[0]>;
    },
    userId: string,
    unreadCounts: Map<string, number>,
  ) {
    const participant =
      conversation.firstUserId === userId
        ? this.mapSocialUser(conversation.secondUser)
        : this.mapSocialUser(conversation.firstUser);
    return {
      id: conversation.id,
      participantId: participant.id,
      participantName: participant.name,
      participantHandle: participant.handle,
      participantInitials: participant.initials,
      participantPhoto: participant.photo,
      unread: unreadCounts.get(conversation.id) ?? 0,
      updatedAt: conversation.updatedAt,
      messages: [...(conversation.messages ?? [])]
        .reverse()
        .map((message) => this.mapPrivateMessage(message, userId)),
    };
  }

  private mapPrivateMessage(
    message: {
      id: string;
      conversationId: string;
      tenantId: string;
      senderId: string;
      body: string;
      readAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      sender: {
        id: string;
        name: string;
        city: string;
        state: string;
        profileImage: string | null;
      };
    },
    userId: string,
  ) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      from: message.sender.name || 'Membro MeetPoint',
      body: message.body,
      time: formatMessageTime(message.createdAt),
      createdAtMs: message.createdAt.getTime(),
      createdAt: message.createdAt,
      readAt: message.readAt,
      mine: message.senderId === userId,
    };
  }

  private uniqueSocialProfiles(
    profiles: Array<ReturnType<SocialService['mapSocialUser']> | null>,
  ) {
    const byHandle = new Map<string, ReturnType<SocialService['mapSocialUser']>>();
    profiles
      .filter((profile): profile is ReturnType<SocialService['mapSocialUser']> => Boolean(profile))
      .forEach((profile) => {
        byHandle.set(profile.handle, profile);
      });
    return [...byHandle.values()];
  }

  private async withPostReactionMetadata<T extends { id: string }>(
    tx: Prisma.TransactionClient,
    posts: T[],
    currentUserId?: string | null,
  ): Promise<Array<T & PostReactionMetadata>> {
    const postIds = posts.map((post) => post.id);
    if (!postIds.length) return [];

    const [groupedReactions, currentUserReactions, recentReactions] =
      await Promise.all([
        tx.postReaction.groupBy({
          by: ['postId', 'type'],
          where: { postId: { in: postIds } },
          _count: { _all: true },
        }),
        currentUserId
          ? tx.postReaction.findMany({
              where: { postId: { in: postIds }, userId: currentUserId },
              select: { postId: true, type: true },
            })
          : Promise.resolve([]),
        tx.postReaction.findMany({
          where: { postId: { in: postIds } },
          orderBy: { createdAt: 'desc' },
          take: postIds.length * 8,
          include: { user: { select: this.publicUserSelect() } },
        }),
      ]);

    const summaryByPost = new Map<string, ReactionSummary>();
    const selectedByPost = new Map<string, PostReactionType>();
    const recentByPost = new Map<string, RecentPostReaction[]>();

    groupedReactions.forEach((reaction) => {
      const type = this.sanitizePostReactionType(reaction.type);
      const summary = summaryByPost.get(reaction.postId) ?? this.emptyReactionSummary();
      summary[type] = reaction._count._all;
      summaryByPost.set(reaction.postId, summary);
    });

    currentUserReactions.forEach((reaction) => {
      selectedByPost.set(
        reaction.postId,
        this.sanitizePostReactionType(reaction.type),
      );
    });

    recentReactions.forEach((reaction) => {
      const type = this.sanitizePostReactionType(reaction.type);
      const current = recentByPost.get(reaction.postId) ?? [];
      if (current.length >= 6) return;
      current.push({
        user: reaction.user.name || 'Membro MeetPoint',
        userId: reaction.userId,
        reaction: type,
        at: reaction.createdAt.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
      recentByPost.set(reaction.postId, current);
    });

    return posts.map((post) => {
      const summary = summaryByPost.get(post.id) ?? this.emptyReactionSummary();
      const totalReactions = Object.values(summary).reduce(
        (total, count) => total + count,
        0,
      );
      const postWithCount = post as T & {
        _count?: Record<string, number>;
      };
      return {
        ...post,
        _count: {
          ...(postWithCount._count ?? {}),
          reactions: totalReactions,
        },
        reactionSummary: summary,
        selectedReaction: selectedByPost.get(post.id) ?? '',
        recentReactions: recentByPost.get(post.id) ?? [],
      };
    });
  }

  private emptyReactionSummary(): ReactionSummary {
    return { like: 0, love: 0, fire: 0, clap: 0 };
  }

  private sanitizePostReactionType(type?: string): PostReactionType {
    const normalized = (type || 'like').trim().toLowerCase();
    if (!POST_REACTION_TYPES.includes(normalized as PostReactionType)) {
      throw new BadRequestException('Invalid post reaction type');
    }
    return normalized as PostReactionType;
  }

  private sanitizePostCreate(dto: CreatePostDto): Prisma.PostUncheckedCreateInput {
    return {
      body: this.sanitizeRequiredText(dto.body, 'body'),
      mediaUrl: dto.mediaUrl,
      mediaType: this.sanitizeOptionalText(dto.mediaType),
      city: this.sanitizeOptionalText(dto.city),
      tag: this.sanitizeOptionalText(dto.tag),
      sharedFromPostId: dto.sharedFromPostId,
    } as Prisma.PostUncheckedCreateInput;
  }

  private sanitizePostUpdate(dto: UpdatePostDto): Prisma.PostUpdateInput {
    return {
      ...(dto.body !== undefined
        ? { body: this.sanitizeRequiredText(dto.body, 'body') }
        : {}),
      ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl } : {}),
      ...(dto.mediaType !== undefined
        ? { mediaType: this.sanitizeOptionalText(dto.mediaType) }
        : {}),
      ...(dto.city !== undefined
        ? { city: this.sanitizeOptionalText(dto.city) }
        : {}),
      ...(dto.tag !== undefined ? { tag: this.sanitizeOptionalText(dto.tag) } : {}),
    };
  }

  private sanitizeRequiredText(value: string, field: string) {
    const sanitized = this.sanitizeText(value);
    if (!sanitized) {
      throw new BadRequestException(`${field} must contain valid text`);
    }
    return sanitized;
  }

  private sanitizeOptionalText(value?: string) {
    if (value === undefined) return undefined;
    return this.sanitizeText(value) || undefined;
  }

  private sanitizeText(value: string) {
    return Array.from(
      value
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, ''),
    )
      .filter((character) => character.charCodeAt(0) !== 0)
      .join('')
      .trim();
  }

  private async ensurePublicPost(id: string) {
    const post = await this.prisma.withPlatformAdmin((tx) =>
      tx.post.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        select: { id: true },
      }),
    );
    if (!post) throw new NotFoundException('Post not found');
  }

  private async ensurePublicCommunity(id: string) {
    const community = await this.prisma.withPlatformAdmin((tx) =>
      tx.community.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        select: { id: true },
      }),
    );
    if (!community) throw new NotFoundException('Community not found');
  }

  private async ensurePublicOpportunity(id: string) {
    const opportunity = await this.prisma.withPlatformAdmin((tx) =>
      tx.opportunity.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        select: { id: true },
      }),
    );
    if (!opportunity) throw new NotFoundException('Opportunity not found');
  }

  private async ensurePublicBenefit(id: string) {
    const benefit = await this.prisma.withPlatformAdmin((tx) =>
      tx.benefit.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        select: { id: true },
      }),
    );
    if (!benefit) throw new NotFoundException('Benefit not found');
  }

  private async ensurePublicEvent(id: string) {
    const event = await this.prisma.withPlatformAdmin((tx) =>
      tx.event.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        select: { id: true },
      }),
    );
    if (!event) throw new NotFoundException('Event not found');
  }

  private async prepareCommunityAccess(
    dto: Pick<
      CreateCommunityDto | UpdateCommunityDto,
      'accessMode' | 'password' | 'inviteCode'
    >,
    current?: {
      accessMode: CommunityAccessMode;
      passwordHash: string | null;
      inviteCodeHash: string | null;
    },
  ) {
    const accessMode = this.toCommunityAccessMode(dto.accessMode) ??
      current?.accessMode ??
      CommunityAccessMode.PUBLIC;

    if (accessMode === CommunityAccessMode.PASSWORD) {
      const password = dto.password?.trim();
      if (!password && !current?.passwordHash) {
        throw new BadRequestException('Community password is required');
      }
      return {
        accessMode,
        passwordHash: password
          ? await hash(password, COMMUNITY_SECRET_HASH_ROUNDS)
          : current?.passwordHash ?? null,
        inviteCodeHash: null,
      };
    }

    if (accessMode === CommunityAccessMode.INVITE_ONLY) {
      const inviteCode = dto.inviteCode?.trim();
      if (!inviteCode && !current?.inviteCodeHash) {
        throw new BadRequestException('Community invite code is required');
      }
      return {
        accessMode,
        passwordHash: null,
        inviteCodeHash: inviteCode
          ? await hash(inviteCode, COMMUNITY_SECRET_HASH_ROUNDS)
          : current?.inviteCodeHash ?? null,
      };
    }

    return {
      accessMode: CommunityAccessMode.PUBLIC,
      passwordHash: null,
      inviteCodeHash: null,
    };
  }

  private toCommunityAccessMode(value?: 'public' | 'invite' | 'password') {
    if (value === 'password') return CommunityAccessMode.PASSWORD;
    if (value === 'invite') return CommunityAccessMode.INVITE_ONLY;
    if (value === 'public') return CommunityAccessMode.PUBLIC;
    return undefined;
  }

  private async assertCommunityCanBeJoined(
    community: {
      accessMode: CommunityAccessMode;
      passwordHash: string | null;
      inviteCodeHash: string | null;
    },
    dto: JoinCommunityDto,
  ) {
    if (community.accessMode === CommunityAccessMode.PUBLIC) return;

    if (community.accessMode === CommunityAccessMode.PASSWORD) {
      const password = dto.password?.trim();
      if (!password || !community.passwordHash) {
        throw new ForbiddenException('Community password is required');
      }
      if (!(await compare(password, community.passwordHash))) {
        throw new ForbiddenException('Invalid community password');
      }
      return;
    }

    const inviteCode = (dto.inviteCode ?? dto.password)?.trim();
    if (!inviteCode || !community.inviteCodeHash) {
      throw new ForbiddenException('Community invite code is required');
    }
    if (!(await compare(inviteCode, community.inviteCodeHash))) {
      throw new ForbiddenException('Invalid community invite code');
    }
  }

  private async assertCommunityMember(
    tx: Prisma.TransactionClient,
    communityId: string,
    userId: string,
  ) {
    const membership = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
      select: {
        role: true,
        community: {
          select: {
            id: true,
            tenantId: true,
            visibility: true,
          },
        },
      },
    });
    if (
      !membership ||
      membership.community.visibility !== ContentVisibility.PUBLIC
    ) {
      throw new ForbiddenException('Community membership is required');
    }
    return {
      id: membership.community.id,
      tenantId: membership.community.tenantId,
      role: membership.role,
    };
  }

  private mapCommunityAccessMode(accessMode: CommunityAccessMode) {
    if (accessMode === CommunityAccessMode.PASSWORD) return 'password';
    if (accessMode === CommunityAccessMode.INVITE_ONLY) return 'invite';
    return 'public';
  }

  private mapCommunityForUser<
    T extends {
      accessMode: CommunityAccessMode;
      members?: Array<{ role: string }>;
    },
  >(community: T) {
    const membership = community.members?.[0];
    const { members: _members, ...safeCommunity } = community;
    return {
      ...safeCommunity,
      accessMode: this.mapCommunityAccessMode(community.accessMode),
      isMember: Boolean(membership),
      membershipRole: membership?.role ?? null,
    };
  }

  private mapCommunityMessage<
    T extends {
      authorId: string;
      body: string;
      createdAt: Date;
      editedAt: Date | null;
      deletedAt: Date | null;
      deletedByAdmin: boolean;
      author: unknown;
    },
  >(message: T, user: AuthenticatedUser) {
    const deleted = Boolean(message.deletedAt);
    return {
      ...message,
      body: deleted ? '' : message.body,
      mine: message.authorId === user.sub,
      deleted,
      deletedByAdmin: message.deletedByAdmin,
      time: formatMessageTime(message.createdAt),
      createdAtMs: message.createdAt.getTime(),
      edited: Boolean(message.editedAt),
    };
  }

  private publicUserSelect() {
    return {
      id: true,
      name: true,
      city: true,
      state: true,
      profileImage: true,
      profileCoverImage: true,
    } satisfies Prisma.UserSelect;
  }

  private socialUserSelect() {
    return {
      id: true,
      tenantId: true,
      email: true,
      name: true,
      city: true,
      state: true,
      profileImage: true,
      profileCoverImage: true,
      bio: true,
      createdAt: true,
    } satisfies Prisma.UserSelect;
  }

  private mapSocialUser(user: {
    id: string;
    tenantId?: string;
    email: string;
    name: string | null;
    city: string | null;
    state: string | null;
    profileImage: string | null;
    profileCoverImage?: string | null;
    bio?: string | null;
    createdAt?: Date | null;
  }) {
    const name = user.name || 'Perfil MeetPoint';
    return {
      id: user.id,
      name,
      handle: buildPublicHandle(name, user.email, user.id),
      initials: buildInitials(name || user.email),
      city: [user.city, user.state].filter(Boolean).join(', ') || 'MeetPoint',
      bio: stripAccountMetadata(user.bio) || 'Perfil cadastrado na plataforma.',
      photo: user.profileImage ?? '',
      coverPhoto: user.profileCoverImage ?? '',
      profileCoverImage: user.profileCoverImage ?? '',
      accountSegment: parseAccountSegmentFromBio(user.bio),
      createdAt: user.createdAt,
    };
  }

  private tenantSelect() {
    return {
      id: true,
      name: true,
      subdomain: true,
    } satisfies Prisma.TenantSelect;
  }

  private postInclude() {
    return {
      tenant: { select: this.tenantSelect() },
      author: { select: this.publicUserSelect() },
      sharedFrom: {
        select: {
          id: true,
          body: true,
          mediaUrl: true,
          mediaType: true,
          city: true,
          tag: true,
          createdAt: true,
          author: { select: this.publicUserSelect() },
        },
      },
      _count: { select: { comments: true, reactions: true } },
    } satisfies Prisma.PostInclude;
  }

  private postCommentInclude() {
    return {
      author: { select: this.publicUserSelect() },
    } satisfies Prisma.PostCommentInclude;
  }

  private privateConversationInclude() {
    return {
      firstUser: { select: this.socialUserSelect() },
      secondUser: { select: this.socialUserSelect() },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: this.privateMessageInclude(),
      },
    } satisfies Prisma.PrivateConversationInclude;
  }

  private privateMessageInclude() {
    return {
      sender: { select: this.publicUserSelect() },
    } satisfies Prisma.PrivateMessageInclude;
  }

  private communityInclude() {
    return {
      tenant: { select: this.tenantSelect() },
      owner: { select: this.publicUserSelect() },
      _count: { select: { members: true } },
    } satisfies Prisma.CommunityInclude;
  }

  private communitySelect(userId?: string) {
    return {
      id: true,
      tenantId: true,
      ownerId: true,
      visibility: true,
      accessMode: true,
      name: true,
      topic: true,
      description: true,
      city: true,
      imageUrl: true,
      memberCount: true,
      createdAt: true,
      updatedAt: true,
      tenant: { select: this.tenantSelect() },
      owner: { select: this.publicUserSelect() },
      _count: { select: { members: true } },
      ...(userId
        ? {
            members: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          }
        : {}),
    } satisfies Prisma.CommunitySelect;
  }

  private communityMessageSelect() {
    return {
      id: true,
      communityId: true,
      tenantId: true,
      authorId: true,
      body: true,
      editedAt: true,
      deletedAt: true,
      deletedByAdmin: true,
      createdAt: true,
      updatedAt: true,
      author: { select: this.publicUserSelect() },
    } satisfies Prisma.CommunityMessageSelect;
  }

  private opportunityInclude() {
    return {
      tenant: { select: this.tenantSelect() },
      owner: { select: this.publicUserSelect() },
      _count: { select: { applications: true } },
    } satisfies Prisma.OpportunityInclude;
  }

  private benefitInclude() {
    return {
      tenant: { select: this.tenantSelect() },
      owner: { select: this.publicUserSelect() },
      _count: { select: { redemptions: true } },
    } satisfies Prisma.BenefitInclude;
  }

  private eventInclude() {
    return {
      tenant: { select: this.tenantSelect() },
      owner: { select: this.publicUserSelect() },
      _count: { select: { registrations: true } },
    } satisfies Prisma.EventInclude;
  }
}

function buildPublicHandle(name: string | null | undefined, email: string, id: string) {
  const source = name?.trim() || email.split('@')[0] || 'perfil';
  const slug = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
  return `@${slug || 'perfil'}${id.slice(0, 4)}`;
}

function buildInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'MP';
}

function parseAccountSegmentFromBio(bio: string | null | undefined) {
  const match =
    bio?.match(/\[\[managed-account-segment:([a-z-]+)\]\]/i) ??
    bio?.match(/\[\[account-segment:([a-z-]+)\]\]/i);
  const value = match?.[1]?.toLowerCase?.() ?? '';
  if (['student', 'teacher', 'company', 'sponsor', 'ambassador', 'platform', 'employee'].includes(value)) {
    return value;
  }
  return 'student';
}

function stripAccountMetadata(bio: string | null | undefined) {
  return (bio ?? '')
    .replace(/\s*Origem administrativa:\s*[^.]+\.?/gi, ' ')
    .replace(/\s*Organizacao:\s*[^.]+\.?/gi, ' ')
    .replace(/\s*Conta criada pelo admin com cortesia administrativa\.?/gi, ' ')
    .replace(/\s*\[\[managed-account:(main|linked)\]\]\s*/gi, ' ')
    .replace(/\s*\[\[managed-account-segment:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s*\[\[managed-account-company:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s*\[\[managed-account-parent:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s*\[\[account-segment:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s*\[\[company-link:[^\]]+\]\]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatMessageTime(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
}
