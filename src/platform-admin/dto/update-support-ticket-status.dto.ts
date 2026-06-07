import { IsEnum } from 'class-validator';
import {
  SupportTicketStatus,
  type SupportTicketStatus as SupportTicketStatusType,
} from '../../common/prisma-enums';

export class UpdateSupportTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatusType;
}
