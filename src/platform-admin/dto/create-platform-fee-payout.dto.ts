import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PixKeyType, type PixKeyType as PixKeyTypeType } from '../../common/prisma-enums';

export class CreatePlatformFeePayoutDto {
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsEnum(PixKeyType)
  pixKeyType!: PixKeyTypeType;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  pixKey!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  accountHolderName!: string;

  @IsString()
  @MaxLength(32)
  @IsOptional()
  accountDocument?: string;
}
