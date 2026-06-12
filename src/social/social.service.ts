import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentVisibility, Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApplyOpportunityDto,
  CreateBenefitDto,
  CreateCommunityDto,
  CreateEventDto,
  CreateOpportunityDto,
  CreatePostCommentDto,
  CreatePostDto,
  CreatePostReactionDto,
  ListPublicContentQueryDto,
  UpdateBenefitDto,
  UpdateCommunityDto,
  UpdateEventDto,
  UpdateOpportunityDto,
  UpdatePostDto,
} from './dto/social-content.dto';

type Pagination = {
  page: number;
  limit: number;
  skip: number;
};

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.postComment.create({
      data: {
        postId,
        tenantId,
        authorId,
        body: this.sanitizeRequiredText(dto.body, 'body'),
      },
      include: { author: { select: this.publicUserSelect() } },
    });
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

  createCommunity(tenantId: string, ownerId: string, dto: CreateCommunityDto) {
    return this.prisma.community.create({
      data: {
        ...dto,
        tenantId,
        ownerId,
        visibility: ContentVisibility.PUBLIC,
        members: {
          create: { tenantId, userId: ownerId, role: 'OWNER' },
        },
        memberCount: 1,
      },
      include: this.communityInclude(),
    });
  }

  async listCommunities(query: ListPublicContentQueryDto) {
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
          include: this.communityInclude(),
        }),
        tx.community.count({ where }),
      ]),
    );
    return this.page(data, total, page, limit);
  }

  async getCommunity(id: string) {
    const community = await this.prisma.withPlatformAdmin((tx) =>
      tx.community.findFirst({
        where: { id, visibility: ContentVisibility.PUBLIC },
        include: this.communityInclude(),
      }),
    );
    if (!community) throw new NotFoundException('Community not found');
    return community;
  }

  async updateCommunity(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateCommunityDto,
  ) {
    const community = await this.prisma.community.findUnique({ where: { id } });
    if (!community) throw new NotFoundException('Community not found');
    this.assertOwnerOrAdmin(community.ownerId, user);
    return this.prisma.community.update({
      where: { id },
      data: dto,
      include: this.communityInclude(),
    });
  }

  async deleteCommunity(id: string, user: AuthenticatedUser) {
    const community = await this.prisma.community.findUnique({ where: { id } });
    if (!community) throw new NotFoundException('Community not found');
    this.assertOwnerOrAdmin(community.ownerId, user);
    await this.prisma.community.delete({ where: { id } });
    return { deleted: true };
  }

  async joinCommunity(tenantId: string, communityId: string, userId: string) {
    await this.ensurePublicCommunity(communityId);
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.communityMember.upsert({
        where: { communityId_userId: { communityId, userId } },
        create: { communityId, tenantId, userId },
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

  private communityInclude() {
    return {
      tenant: { select: this.tenantSelect() },
      owner: { select: this.publicUserSelect() },
      _count: { select: { members: true } },
    } satisfies Prisma.CommunityInclude;
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
