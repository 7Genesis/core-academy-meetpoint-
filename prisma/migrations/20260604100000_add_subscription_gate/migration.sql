-- Subscription gate, recurring plans and activation audit trail.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountStatus') THEN
    ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'PENDING_REGISTRATION';
    ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';
    ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PROCESSING';
    ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
    ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
    ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM (
      'PENDING_PAYMENT',
      'PAYMENT_PROCESSING',
      'ACTIVE',
      'SUSPENDED',
      'EXPIRED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  "billingCycle" TEXT NOT NULL,
  features JSONB NOT NULL,
  "maxStorage" INTEGER,
  "maxUploads" INTEGER,
  "maxCommunities" INTEGER,
  "maxMessages" INTEGER,
  "maxEvents" INTEGER,
  "maxCourses" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "planId" UUID NOT NULL,
  status "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "paymentProvider" TEXT,
  "externalSubscriptionId" TEXT,
  "startedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "renewalDate" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT subscriptions_user_id_fkey
    FOREIGN KEY ("userId") REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT subscriptions_plan_id_fkey
    FOREIGN KEY ("planId") REFERENCES subscription_plans(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS subscription_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "subscriptionId" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "oldStatus" TEXT,
  "newStatus" TEXT,
  "paymentReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT subscription_audit_logs_user_id_fkey
    FOREIGN KEY ("userId") REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT subscription_audit_logs_subscription_id_fkey
    FOREIGN KEY ("subscriptionId") REFERENCES subscriptions(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS subscription_plans_is_active_idx
  ON subscription_plans ("isActive");

CREATE INDEX IF NOT EXISTS subscription_plans_billing_cycle_idx
  ON subscription_plans ("billingCycle");

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx
  ON subscriptions ("userId");

CREATE INDEX IF NOT EXISTS subscriptions_plan_id_idx
  ON subscriptions ("planId");

CREATE INDEX IF NOT EXISTS subscriptions_status_idx
  ON subscriptions (status);

CREATE INDEX IF NOT EXISTS subscriptions_external_subscription_id_idx
  ON subscriptions ("externalSubscriptionId");

CREATE INDEX IF NOT EXISTS subscription_audit_logs_user_id_idx
  ON subscription_audit_logs ("userId");

CREATE INDEX IF NOT EXISTS subscription_audit_logs_subscription_id_idx
  ON subscription_audit_logs ("subscriptionId");

CREATE INDEX IF NOT EXISTS subscription_audit_logs_event_type_idx
  ON subscription_audit_logs ("eventType");

CREATE INDEX IF NOT EXISTS subscription_audit_logs_created_at_idx
  ON subscription_audit_logs ("createdAt");
