ALTER TABLE "users" ADD COLUMN "lastActivityAt" TIMESTAMP(3);
UPDATE "users" SET "lastActivityAt" = "lastLoginAt" WHERE "lastLoginAt" IS NOT NULL;
CREATE INDEX "users_lastActivityAt_idx" ON "users"("lastActivityAt");
