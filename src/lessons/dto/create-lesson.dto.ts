import {
  IsEnum,
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
import {
  LessonCompletionRequirement,
  type LessonCompletionRequirement as LessonCompletionRequirementType,
} from '../../common/prisma-enums';

export class CreateLessonDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsInt()
  @Min(1)
  order: number;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  videoUrl?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  attachmentUrl?: string;

  @IsEnum(LessonCompletionRequirement)
  @IsOptional()
  completionRequirement?: LessonCompletionRequirementType;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  requiredVideoPercent?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  progressWeight?: number;

  @IsUUID()
  moduleId: string;
}
