import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';

export class PrivacyConsentDto {
  @IsString()
  @MaxLength(64)
  termsVersion!: string;

  @IsString()
  @MaxLength(64)
  privacyVersion!: string;

  @IsString()
  @MaxLength(64)
  consentType!: string;

  @IsBoolean()
  accepted!: boolean;

  @IsString()
  @IsIn(['BR', ''])
  @MaxLength(8)
  country!: string;
}
