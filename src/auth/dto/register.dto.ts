import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'password must contain uppercase, lowercase and number',
  })
  password!: string;

  @IsString()
  passwordConfirm!: string;

  @IsString()
  @MinLength(2)
  city!: string;

  @IsString()
  @MinLength(2)
  state!: string;

  @IsString()
  @MinLength(10)
  phone!: string;

  @IsOptional()
  @IsString()
  profileImage?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsBoolean()
  acceptedTerms!: boolean;

  @IsBoolean()
  acceptedPrivacyPolicy!: boolean;

  @IsOptional()
  @IsString()
  termsVersion?: string;

  @IsOptional()
  @IsString()
  privacyVersion?: string;

  @IsString()
  @MinLength(6)
  emailVerificationCode!: string;

  @IsString()
  @MinLength(6)
  phoneVerificationCode!: string;
}
