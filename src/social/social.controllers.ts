import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequireActiveSubscription } from '../common/decorators/require-active-subscription.decorator';
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
import { SocialService } from './social.service';

type TenantRequest = Request & { tenantId: string };

@Controller('posts')
export class PostsController {
  constructor(private readonly socialService: SocialService) {}

  @Public()
  @Get()
  findAll(
    @Query() query: ListPublicContentQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.socialService.listPosts(query, user);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.socialService.getPost(id, user);
  }

  @RequireActiveSubscription()
  @Post()
  create(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.socialService.createPost(request.tenantId, user.sub, dto);
  }

  @RequireActiveSubscription()
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePostDto,
  ) {
    return this.socialService.updatePost(id, user, dto);
  }

  @RequireActiveSubscription()
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialService.deletePost(id, user);
  }

  @RequireActiveSubscription()
  @Post(':id/comments')
  comment(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostCommentDto,
  ) {
    return this.socialService.commentPost(request.tenantId, id, user.sub, dto);
  }

  @RequireActiveSubscription()
  @Post(':id/reactions')
  react(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostReactionDto,
  ) {
    return this.socialService.reactPost(request.tenantId, id, user.sub, dto);
  }
}

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly socialService: SocialService) {}

  @Public()
  @Get()
  findAll(@Query() query: ListPublicContentQueryDto) {
    return this.socialService.listCommunities(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.socialService.getCommunity(id);
  }

  @RequireActiveSubscription()
  @Post()
  create(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunityDto,
  ) {
    return this.socialService.createCommunity(request.tenantId, user.sub, dto);
  }

  @RequireActiveSubscription()
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.socialService.updateCommunity(id, user, dto);
  }

  @RequireActiveSubscription()
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialService.deleteCommunity(id, user);
  }

  @RequireActiveSubscription()
  @Post(':id/join')
  join(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialService.joinCommunity(request.tenantId, id, user.sub);
  }
}

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly socialService: SocialService) {}

  @Public()
  @Get()
  findAll(@Query() query: ListPublicContentQueryDto) {
    return this.socialService.listOpportunities(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.socialService.getOpportunity(id);
  }

  @RequireActiveSubscription()
  @Post()
  create(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOpportunityDto,
  ) {
    return this.socialService.createOpportunity(request.tenantId, user.sub, dto);
  }

  @RequireActiveSubscription()
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.socialService.updateOpportunity(id, user, dto);
  }

  @RequireActiveSubscription()
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialService.deleteOpportunity(id, user);
  }

  @RequireActiveSubscription()
  @Post(':id/apply')
  apply(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyOpportunityDto,
  ) {
    return this.socialService.applyOpportunity(
      request.tenantId,
      id,
      user.sub,
      dto,
    );
  }
}

@Controller('benefits')
export class BenefitsController {
  constructor(private readonly socialService: SocialService) {}

  @Public()
  @Get()
  findAll(@Query() query: ListPublicContentQueryDto) {
    return this.socialService.listBenefits(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.socialService.getBenefit(id);
  }

  @RequireActiveSubscription()
  @Post()
  create(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBenefitDto,
  ) {
    return this.socialService.createBenefit(request.tenantId, user.sub, dto);
  }

  @RequireActiveSubscription()
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBenefitDto,
  ) {
    return this.socialService.updateBenefit(id, user, dto);
  }

  @RequireActiveSubscription()
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialService.deleteBenefit(id, user);
  }

  @RequireActiveSubscription()
  @Post(':id/redeem')
  redeem(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialService.redeemBenefit(request.tenantId, id, user.sub);
  }
}

@Controller('events')
export class EventsController {
  constructor(private readonly socialService: SocialService) {}

  @Public()
  @Get()
  findAll(@Query() query: ListPublicContentQueryDto) {
    return this.socialService.listEvents(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.socialService.getEvent(id);
  }

  @RequireActiveSubscription()
  @Post()
  create(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEventDto,
  ) {
    return this.socialService.createEvent(request.tenantId, user.sub, dto);
  }

  @RequireActiveSubscription()
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateEventDto,
  ) {
    return this.socialService.updateEvent(id, user, dto);
  }

  @RequireActiveSubscription()
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialService.deleteEvent(id, user);
  }

  @RequireActiveSubscription()
  @Post(':id/register')
  register(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialService.registerEvent(request.tenantId, id, user.sub);
  }
}
