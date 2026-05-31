import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthenticatedUser = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'STUDENT';
  tenantId?: string;
  platformRole?: 'OWNER' | 'SUPPORT' | 'OPERATIONS' | 'MAINTENANCE';
  jti?: string;
  exp?: number;
  iat?: number;
};

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
