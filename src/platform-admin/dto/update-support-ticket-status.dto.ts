import { SupportTicketStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateSupportTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;
}
