import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

export type PrivateRealtimeMessage = {
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
};

export type PrivateRealtimeMessageEvent = {
  conversationId: string;
  kind: 'message.created' | 'message.read';
  message: PrivateRealtimeMessage;
};

@Injectable()
export class PrivateMessagesRealtimeService {
  private readonly events = new Subject<PrivateRealtimeMessageEvent>();

  publish(event: PrivateRealtimeMessageEvent) {
    this.events.next(event);
  }

  stream(conversationId: string) {
    return this.events
      .asObservable()
      .pipe(filter((event) => event.conversationId === conversationId));
  }
}
