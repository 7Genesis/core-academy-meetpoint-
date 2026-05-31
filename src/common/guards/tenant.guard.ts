import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_PLATFORM_WIDE_KEY } from '../decorators/platform-wide.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isPlatformWide = this.reflector.getAllAndOverride<boolean>(
      IS_PLATFORM_WIDE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPlatformWide) return true;

    const request = context.switchToHttp().getRequest();
    const headerTenantId = request.headers['x-tenant-id'];
    const normalizedHeaderTenantId = Array.isArray(headerTenantId)
      ? headerTenantId[0]
      : headerTenantId;
    const jwtTenantId = request.user?.tenantId;

    if (!jwtTenantId) {
      throw new ForbiddenException('JWT tenantId is required');
    }

    if (!isUuid(jwtTenantId)) {
      throw new ForbiddenException('JWT tenantId is invalid');
    }

    if (normalizedHeaderTenantId && !isUuid(normalizedHeaderTenantId)) {
      throw new BadRequestException('X-Tenant-ID must be a valid UUID');
    }

    if (normalizedHeaderTenantId && normalizedHeaderTenantId !== jwtTenantId) {
      throw new ForbiddenException('JWT tenant does not match request tenant');
    }

    request.tenantId = jwtTenantId;
    return true;
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
