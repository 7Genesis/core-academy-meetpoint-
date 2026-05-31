import { PlatformPermission, PlatformRole } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePlatformStaffDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsEnum(PlatformRole)
  @IsOptional()
  role?: PlatformRole;

  @IsArray()
  @ArrayUnique()
  @IsEnum(PlatformPermission, { each: true })
  permissions!: PlatformPermission[];
}
