import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateCourseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @IsOptional()
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  topic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  coverUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  instructorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  publisherType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  linkedCompanyName?: string;

  @IsOptional()
  @IsUUID()
  creatorUserId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priceCents?: number;

  @IsIn(['BRL'])
  @IsOptional()
  currency?: string;

  @IsInt()
  @Min(0)
  @Max(5000)
  @IsOptional()
  platformFeeBps?: number;
}
