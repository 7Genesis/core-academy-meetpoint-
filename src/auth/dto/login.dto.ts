import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsBoolean()
  termsAccepted!: boolean;

  @IsString()
  termsVersion!: string;

  @IsString()
  privacyVersion!: string;

  @IsString()
  consentType!: string;

  @IsOptional()
  @IsString()
  country?: string;
}
