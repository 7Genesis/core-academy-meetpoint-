import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ACTIVE_SUBSCRIPTION_KEY } from '../common/decorators/require-active-subscription.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiresSubscription = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ACTIVE_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresSubscription) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { sub?: string; platformRole?: string };
    }>();
    if (request.user?.platformRole) return true;
    if (!request.user?.sub) {
      throw new ForbiddenException('Authenticated user is required');
    }

    const active = await this.subscriptionsService.hasActiveSubscription(request.user.sub);
    if (!active) {
      throw new ForbiddenException('Active subscription is required');
    }

    return true;
  }
}
