import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SupportChatDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message!: string;

  @IsEmail()
  @MaxLength(254)
  @IsOptional()
  email?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  segment?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  preferredChannel?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @IsString()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  @IsOptional()
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  conversationSummary?: string;
}
