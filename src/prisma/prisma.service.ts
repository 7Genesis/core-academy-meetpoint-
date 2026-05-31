import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type TenantTransactionClient = Prisma.TransactionClient;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    if (process.env.SKIP_DATABASE_CONNECT === 'true') {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async withTenant<T>(
    tenantId: string,
    callback: (tx: TenantTransactionClient) => Promise<T>,
  ): Promise<T> {
    assertUuid(tenantId, 'tenantId');

    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return callback(tx);
    });
  }

  async withPlatformAdmin<T>(
    callback: (tx: TenantTransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      return callback(tx);
    });
  }
}

function assertUuid(value: string, label: string) {
  const valid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  if (!valid) {
    throw new BadRequestException(`${label} must be a valid UUID`);
  }
}
