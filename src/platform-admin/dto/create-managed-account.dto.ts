import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const ManagedAccountSegment = {
  student: 'student',
  teacher: 'teacher',
  company: 'company',
  sponsor: 'sponsor',
  ambassador: 'ambassador',
} as const;

export type ManagedAccountSegment = keyof typeof ManagedAccountSegment;

export class CreateManagedLinkedPersonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class CreateManagedAccountDto {
  @IsEnum(ManagedAccountSegment)
  segment!: ManagedAccountSegment;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2)
  state!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  companyName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;

  @IsBoolean()
  @IsOptional()
  grantFreeAccess?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateManagedLinkedPersonDto)
  @IsOptional()
  linkedPeople?: CreateManagedLinkedPersonDto[];
}
