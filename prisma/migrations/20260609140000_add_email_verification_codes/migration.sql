CREATE TABLE IF NOT EXISTS "email_verification_codes" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'registration',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_verification_codes_email_idx" ON "email_verification_codes"("email");
CREATE INDEX IF NOT EXISTS "email_verification_codes_purpose_idx" ON "email_verification_codes"("purpose");
CREATE INDEX IF NOT EXISTS "email_verification_codes_expiresAt_idx" ON "email_verification_codes"("expiresAt");
