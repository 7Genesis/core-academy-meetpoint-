import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

export function assertTenantScope(
  user: Pick<AuthenticatedUser, 'tenantId' | 'platformRole'>,
  tenantId: string,
) {
  if (user.platformRole) return;
  if (!user.tenantId || user.tenantId !== tenantId) {
    throw new ForbiddenException('Cross-tenant access denied');
  }
}

export function assertSelfOrPrivileged(
  user: Pick<AuthenticatedUser, 'sub' | 'role' | 'platformRole'>,
  targetUserId: string,
) {
  if (user.platformRole || user.role === 'ADMIN' || user.sub === targetUserId) {
    return;
  }
  throw new ForbiddenException('User object access denied');
}
