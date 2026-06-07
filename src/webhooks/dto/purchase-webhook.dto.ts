import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EnrollmentPaymentStatus,
  type EnrollmentPaymentStatus as EnrollmentPaymentStatusType,
} from '../../common/prisma-enums';

export class PurchaseWebhookDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  courseId: string;

  @IsEmail()
  @MaxLength(254)
  customerEmail: string;

  @IsString()
  @MaxLength(160)
  gatewayPaymentId: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  gateway?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  amountCents?: number;

  @IsIn([
    EnrollmentPaymentStatus.PAID,
    EnrollmentPaymentStatus.FAILED,
    EnrollmentPaymentStatus.REFUNDED,
  ])
  @IsOptional()
  paymentStatus?: EnrollmentPaymentStatusType;
}
