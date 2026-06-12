import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

export type SocialRealtimeNotificationEvent = {
  recipientId: string;
  kind: 'notification.created';
  notification: {
    id: string;
    title: string;
    channel: string;
    read: boolean;
    type: string;
    actorHandle: string;
    createdAt: Date;
    metadata?: unknown;
    actor?: {
      id: string;
      name: string;
      handle: string;
      initials: string;
      city: string;
      bio: string;
      photo: string;
      accountSegment?: string | null;
      createdAt?: Date | null;
    } | null;
  };
};

@Injectable()
export class SocialNotificationsRealtimeService {
  private readonly events = new Subject<SocialRealtimeNotificationEvent>();

  publish(event: SocialRealtimeNotificationEvent) {
    this.events.next(event);
  }

  stream(recipientId: string) {
    return this.events
      .asObservable()
      .pipe(filter((event) => event.recipientId === recipientId));
  }
}
