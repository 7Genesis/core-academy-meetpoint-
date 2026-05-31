import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class DemoLoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(256)
  password!: string;
}
