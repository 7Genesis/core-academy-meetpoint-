import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePublicProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_500_000)
  profileImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_500_000)
  profileCoverImage?: string;
}
