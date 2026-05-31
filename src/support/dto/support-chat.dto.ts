import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
