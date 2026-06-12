import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

export type PostRealtimeComment = {
  id: string;
  postId: string;
  tenantId: string;
  authorId: string;
  body: string;
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

export type PostCommentRealtimeEvent =
  | {
      postId: string;
      kind: 'comment.created' | 'comment.updated';
      comment: PostRealtimeComment;
    }
  | {
      postId: string;
      kind: 'comment.deleted';
      commentId: string;
    };

@Injectable()
export class PostCommentsRealtimeService {
  private readonly events = new Subject<PostCommentRealtimeEvent>();

  publish(event: PostCommentRealtimeEvent) {
    this.events.next(event);
  }

  stream(postId: string) {
    return this.events
      .asObservable()
      .pipe(filter((event) => event.postId === postId));
  }
}
