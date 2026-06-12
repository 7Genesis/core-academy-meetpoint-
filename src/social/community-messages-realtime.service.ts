import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

export type CommunityRealtimeMessage = {
  id: string;
  communityId: string;
  tenantId: string;
  authorId: string;
  body: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
    city: string;
    state: string;
    profileImage: string | null;
  };
};

export type CommunityRealtimeMessageKind =
  | 'message.created'
  | 'message.updated'
  | 'message.deleted';

export type CommunityRealtimeMessageEvent = {
  communityId: string;
  kind: CommunityRealtimeMessageKind;
  message: CommunityRealtimeMessage;
};

@Injectable()
export class CommunityMessagesRealtimeService {
  private readonly events = new Subject<CommunityRealtimeMessageEvent>();

  publish(event: CommunityRealtimeMessageEvent) {
    this.events.next(event);
  }

  stream(communityId: string) {
    return this.events
      .asObservable()
      .pipe(filter((event) => event.communityId === communityId));
  }
}
