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
  Sse,
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
import { SocialService } from './social.service';

type TenantRequest = Request & { tenantId: string };

@Controller('posts')
export class PostsController {
  constructor(private readonly socialService: SocialService) {}

  @Public()
  @Get()
  findAll(@Query() query: ListPublicContentQueryDto) {
    return this.socialService.listPosts(query);
  }

  @Public()
  @Get(':id/comments')
  comments(
    @Param('id') id: string,
    @Query() query: ListPostCommentsQueryDto,
  ) {
    return this.socialService.listPostComments(id, query);
  }

  @Public()
  @Sse(':id/comments/stream')
  streamComments(@Param('id') id: string) {
    return this.socialService.streamPostComments(id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.socialService.getPost(id);
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
  @Patch(':id/comments/:commentId')
  updateComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePostCommentDto,
  ) {
    return this.socialService.updatePostComment(id, commentId, user, dto);
  }

  @RequireActiveSubscription()
  @Delete(':id/comments/:commentId')
  deleteComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialService.deletePostComment(id, commentId, user);
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
  findAll(
    @Query() query: ListPublicContentQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.socialService.listCommunities(query, user);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.socialService.getCommunity(id, user);
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
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: JoinCommunityDto,
  ) {
    return this.socialService.joinCommunity(id, user.sub, dto);
  }

  @RequireActiveSubscription()
  @Get(':id/messages')
  listMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCommunityMessagesQueryDto,
  ) {
    return this.socialService.listCommunityMessages(id, user, query);
  }

  @RequireActiveSubscription()
  @Sse(':id/messages/stream')
  streamMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialService.streamCommunityMessages(id, user);
  }

  @RequireActiveSubscription()
  @Post(':id/messages')
  createMessage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunityMessageDto,
  ) {
    return this.socialService.createCommunityMessage(id, user, dto);
  }

  @RequireActiveSubscription()
  @Patch(':id/messages/:messageId')
  updateMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommunityMessageDto,
  ) {
    return this.socialService.updateCommunityMessage(id, messageId, user, dto);
  }

  @RequireActiveSubscription()
  @Delete(':id/messages/:messageId')
  deleteMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialService.deleteCommunityMessage(id, messageId, user);
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
