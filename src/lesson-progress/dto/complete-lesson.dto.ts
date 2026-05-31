import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CompleteLessonDto {
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  videoWatchedPercent?: number;

  @IsBoolean()
  @IsOptional()
  taskSubmitted?: boolean;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  @IsOptional()
  evidenceUrl?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  completionNote?: string;
}
