import { IsIn, IsOptional, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class CreateCourseCheckoutDto {
  @IsUUID()
  courseId: string;

  @IsIn(['card', 'pix', 'boleto'])
  @IsOptional()
  paymentMethod?: 'card' | 'pix' | 'boleto';

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(2048)
  @IsOptional()
  successUrl?: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(2048)
  @IsOptional()
  cancelUrl?: string;
}
