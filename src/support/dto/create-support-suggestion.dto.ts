import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportSuggestionDto {
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  subject!: string;

  @IsString()
  @MinLength(10)
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
}
