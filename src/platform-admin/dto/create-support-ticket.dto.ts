import { SupportTicketPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(4)
  subject!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(SupportTicketPriority)
  @IsOptional()
  priority?: SupportTicketPriority;

  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @IsUUID()
  @IsOptional()
  userId?: string;
}
