import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformPermission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PLATFORM_PERMISSIONS_KEY } from './platform-permissions.decorator';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  private readonly allowedRoles = new Set([
    'OWNER',
    'SUPPORT',
    'OPERATIONS',
    'MAINTENANCE',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requiredPermissions =
      this.reflector.getAllAndOverride<PlatformPermission[]>(
        PLATFORM_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (!user?.platformRole || !this.allowedRoles.has(user.platformRole)) {
      throw new ForbiddenException('Platform admin access is required');
    }

    const staff = await this.prisma.withPlatformAdmin((tx) =>
      tx.platformStaff.findFirst({
        where: {
          isActive: true,
          OR: [{ id: user.sub }, { email: user.email }],
        },
        include: { permissions: true },
      }),
    );

    if (!staff) {
      throw new ForbiddenException('Active platform staff is required');
    }

    request.platformStaff = staff;

    if (staff.role === 'OWNER') {
      return true;
    }

    if (requiredPermissions.length === 0) {
      return true;
    }

    const staffPermissions = new Set(
      staff.permissions.map((permission) => permission.permission),
    );
    const allowed = requiredPermissions.every((permission) =>
      staffPermissions.has(permission),
    );

    if (!allowed) {
      throw new ForbiddenException('Insufficient platform permission');
    }

    return true;
  }
}
