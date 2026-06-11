import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  BenefitsController,
  CommunitiesController,
  EventsController,
  OpportunitiesController,
  PostsController,
} from './social.controllers';
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
  providers: [SocialService],
})
export class SocialModule {}
