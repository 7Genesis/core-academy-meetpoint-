import type {
  EnrollmentPaymentStatus as PrismaEnrollmentPaymentStatus,
  LessonCompletionRequirement as PrismaLessonCompletionRequirement,
  PixKeyType as PrismaPixKeyType,
  PlatformPermission as PrismaPlatformPermission,
  PlatformRole as PrismaPlatformRole,
  SupportTicketPriority as PrismaSupportTicketPriority,
  SupportTicketStatus as PrismaSupportTicketStatus,
} from '@prisma/client';

export const EnrollmentPaymentStatus = {
  FREE: 'FREE',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const satisfies Record<
  PrismaEnrollmentPaymentStatus,
  PrismaEnrollmentPaymentStatus
>;
export type EnrollmentPaymentStatus = PrismaEnrollmentPaymentStatus;

export const LessonCompletionRequirement = {
  VIDEO_WATCHED: 'VIDEO_WATCHED',
  TASK_SUBMITTED: 'TASK_SUBMITTED',
  MANUAL_CONFIRMATION: 'MANUAL_CONFIRMATION',
  ANY: 'ANY',
} as const satisfies Record<
  PrismaLessonCompletionRequirement,
  PrismaLessonCompletionRequirement
>;
export type LessonCompletionRequirement = PrismaLessonCompletionRequirement;

export const PixKeyType = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  RANDOM: 'RANDOM',
} as const satisfies Record<PrismaPixKeyType, PrismaPixKeyType>;
export type PixKeyType = PrismaPixKeyType;

export const PlatformPermission = {
  USERS_WRITE: 'USERS_WRITE',
  COMPANIES_WRITE: 'COMPANIES_WRITE',
  COURSES_WRITE: 'COURSES_WRITE',
  PAYMENTS_READ: 'PAYMENTS_READ',
  SUPPORT_WRITE: 'SUPPORT_WRITE',
  MAINTENANCE_WRITE: 'MAINTENANCE_WRITE',
} as const satisfies Record<PrismaPlatformPermission, PrismaPlatformPermission>;
export type PlatformPermission = PrismaPlatformPermission;

export const PlatformRole = {
  OWNER: 'OWNER',
  SUPPORT: 'SUPPORT',
  OPERATIONS: 'OPERATIONS',
  MAINTENANCE: 'MAINTENANCE',
} as const satisfies Record<PrismaPlatformRole, PrismaPlatformRole>;
export type PlatformRole = PrismaPlatformRole;

export const SupportTicketPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const satisfies Record<
  PrismaSupportTicketPriority,
  PrismaSupportTicketPriority
>;
export type SupportTicketPriority = PrismaSupportTicketPriority;

export const SupportTicketStatus = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const satisfies Record<PrismaSupportTicketStatus, PrismaSupportTicketStatus>;
export type SupportTicketStatus = PrismaSupportTicketStatus;
