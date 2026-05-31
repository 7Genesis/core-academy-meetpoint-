import { IsString, MaxLength, MinLength } from 'class-validator';

export class BlockUserDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
