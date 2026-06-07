import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import {
  PlatformPermission,
  type PlatformPermission as PlatformPermissionType,
} from '../../common/prisma-enums';

export class UpdatePlatformStaffPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(PlatformPermission, { each: true })
  permissions!: PlatformPermissionType[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
