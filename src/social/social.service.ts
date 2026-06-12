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
  Prisma,
  UserRole,
} from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { defer, from, interval, merge, Observable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityMessagesRealtimeService } from './community-messages-realtime.service';
import { PostCommentsRealtimeService } from './post-comments-realtime.service';
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
  JoinCommunityDto,
  ListPostCommentsQueryDto,
  ListCommunityMessagesQueryDto,
  ListPublicContentQueryDto,
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

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communityMessagesRealtime: CommunityMessagesRealtimeService,
    private readonly postCommentsRealtime: PostCommentsRealtimeService,
  ) {}

  createPost(tenantId: string, authorId: string, dto: CreatePostDto) {
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

  async listPosts(query: ListPublicContentQueryDto) {
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

    const [data, total] = await this.prisma.withPlatformAdmin((tx) =>
      Promise.all([
        tx.post.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: this.postInclude(),
        }),
        tx.post.count({ where }),
      ]),
    );

    return this.page(data, total, page, limit);
  }

  async getPost(id: string) {
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
    return post;
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
    await this.ensurePublicPost(postId);
    return this.prisma.postReaction.upsert({
      where: {
        postId_userId_type: {
          postId,
          userId,
          type: dto.type ?? 'like',
        },
      },
      create: {
        postId,
        tenantId,
        userId,
        type: dto.type ?? 'like',
      },
      update: {},
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

  private sanitizePostCreate(dto: CreatePostDto): Prisma.PostUncheckedCreateInput {
    return {
      body: this.sanitizeRequiredText(dto.body, 'body'),
      mediaUrl: dto.mediaUrl,
      mediaType: this.sanitizeOptionalText(dto.mediaType),
      city: this.sanitizeOptionalText(dto.city),
      tag: this.sanitizeOptionalText(dto.tag),
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
      time: message.createdAt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
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
    } satisfies Prisma.UserSelect;
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
      _count: { select: { comments: true, reactions: true } },
    } satisfies Prisma.PostInclude;
  }

  private postCommentInclude() {
    return {
      author: { select: this.publicUserSelect() },
    } satisfies Prisma.PostCommentInclude;
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
