import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrent(tenantId: string) {
    const tenant = await this.prisma.withTenant(tenantId, (tx) => {
      return tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, subdomain: true, createdAt: true },
      });
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }
}
