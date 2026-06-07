import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import {
  SupportTicketPriority,
  type SupportTicketPriority as SupportTicketPriorityType,
} from '../../common/prisma-enums';

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(4)
  subject!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(SupportTicketPriority)
  @IsOptional()
  priority?: SupportTicketPriorityType;

  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @IsUUID()
  @IsOptional()
  userId?: string;
}
