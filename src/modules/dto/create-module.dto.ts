import { IsInt, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateModuleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsInt()
  @Min(1)
  order: number;

  @IsUUID()
  courseId: string;
}
