import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  BenefitsController,
  CommunitiesController,
  EventsController,
  OpportunitiesController,
  PostsController,
  PrivateConversationsController,
  SocialConnectionsController,
} from './social.controllers';
import { CommunityMessagesRealtimeService } from './community-messages-realtime.service';
import { PrivateMessagesRealtimeService } from './private-messages-realtime.service';
import { PostCommentsRealtimeService } from './post-comments-realtime.service';
import { SocialNotificationsRealtimeService } from './social-notifications-realtime.service';
import { SocialService } from './social.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    SocialConnectionsController,
    PostsController,
    CommunitiesController,
    PrivateConversationsController,
    OpportunitiesController,
    BenefitsController,
    EventsController,
  ],
  providers: [
    CommunityMessagesRealtimeService,
    PrivateMessagesRealtimeService,
    PostCommentsRealtimeService,
    SocialNotificationsRealtimeService,
    SocialService,
  ],
})
export class SocialModule {}
