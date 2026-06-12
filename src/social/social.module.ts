import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  BenefitsController,
  CommunitiesController,
  EventsController,
  OpportunitiesController,
  PostsController,
} from './social.controllers';
import { CommunityMessagesRealtimeService } from './community-messages-realtime.service';
import { PostCommentsRealtimeService } from './post-comments-realtime.service';
import { SocialService } from './social.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    PostsController,
    CommunitiesController,
    OpportunitiesController,
    BenefitsController,
    EventsController,
  ],
  providers: [
    CommunityMessagesRealtimeService,
    PostCommentsRealtimeService,
    SocialService,
  ],
})
export class SocialModule {}
