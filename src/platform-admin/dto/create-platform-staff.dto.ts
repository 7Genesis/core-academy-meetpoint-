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
import {
  PlatformPermission,
  type PlatformPermission as PlatformPermissionType,
  PlatformRole,
  type PlatformRole as PlatformRoleType,
} from '../../common/prisma-enums';

export class CreatePlatformStaffDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsEnum(PlatformRole)
  @IsOptional()
  role?: PlatformRoleType;

  @IsArray()
  @ArrayUnique()
  @IsEnum(PlatformPermission, { each: true })
  permissions!: PlatformPermissionType[];
}
