import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountStatus } from '@prisma/client';
import { REQUIRE_ACTIVE_SUBSCRIPTION_KEY } from '../common/decorators/require-active-subscription.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiresSubscription = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ACTIVE_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresSubscription) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { sub?: string; platformRole?: string; role?: string };
    }>();
    if (request.user?.platformRole || request.user?.role === 'ADMIN') return true;
    if (!request.user?.sub) {
      throw new ForbiddenException('Authenticated user is required');
    }

    if (await this.hasManagedAccountAccess(request.user.sub)) return true;

    const active = await this.subscriptionsService.hasActiveSubscription(request.user.sub);
    if (!active) {
      throw new ForbiddenException('Active subscription is required');
    }

    return true;
  }

  private async hasManagedAccountAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bio: true, status: true },
    });
    return (
      user?.status === AccountStatus.ACTIVE &&
      /\[\[managed-account:(main|linked)\]\]/i.test(user.bio ?? '')
    );
  }
}
