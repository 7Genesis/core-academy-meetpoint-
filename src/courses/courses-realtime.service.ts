import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type CourseCatalogEvent =
  | {
      kind: 'course.created' | 'course.updated';
      course: Record<string, unknown>;
    }
  | {
      kind: 'course.deleted';
      courseId: string;
    };

@Injectable()
export class CoursesRealtimeService {
  private readonly events = new Subject<CourseCatalogEvent>();

  publish(event: CourseCatalogEvent) {
    this.events.next(event);
  }

  stream() {
    return this.events.asObservable();
  }
}
