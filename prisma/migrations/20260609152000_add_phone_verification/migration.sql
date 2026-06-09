ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contactPhoneHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contactPhoneEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contactPhoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_tenantId_contactPhoneHash_key" ON "users"("tenantId", "contactPhoneHash");
CREATE INDEX IF NOT EXISTS "users_contactPhoneHash_idx" ON "users"("contactPhoneHash");

CREATE TABLE IF NOT EXISTS "phone_verification_codes" (
  "id" UUID NOT NULL,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'registration',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "phone_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "phone_verification_codes_phone_idx" ON "phone_verification_codes"("phone");
CREATE INDEX IF NOT EXISTS "phone_verification_codes_purpose_idx" ON "phone_verification_codes"("purpose");
CREATE INDEX IF NOT EXISTS "phone_verification_codes_expiresAt_idx" ON "phone_verification_codes"("expiresAt");
