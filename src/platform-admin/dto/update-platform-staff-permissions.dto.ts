import { PlatformPermission } from '@prisma/client';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdatePlatformStaffPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(PlatformPermission, { each: true })
  permissions!: PlatformPermission[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
