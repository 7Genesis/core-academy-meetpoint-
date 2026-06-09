import { IsString, MinLength } from 'class-validator';

export class ReplySupportTicketDto {
  @IsString()
  @MinLength(2)
  message!: string;
}
