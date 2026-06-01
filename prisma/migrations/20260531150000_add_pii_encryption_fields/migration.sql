-- PII hardening: encrypted fields plus deterministic lookup hashes.
-- Apply before backfilling legacy rows and before removing plaintext dependencies.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "emailHash" TEXT,
  ADD COLUMN IF NOT EXISTS "emailEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "lastLoginIpEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "lastKnownGeoEncrypted" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_hash_key
  ON users ("tenantId", "emailHash");

CREATE INDEX IF NOT EXISTS users_email_hash_idx
  ON users ("emailHash");

ALTER TABLE platform_staff
  ADD COLUMN IF NOT EXISTS "emailHash" TEXT,
  ADD COLUMN IF NOT EXISTS "emailEncrypted" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS platform_staff_email_hash_key
  ON platform_staff ("emailHash");

CREATE INDEX IF NOT EXISTS platform_staff_email_hash_idx
  ON platform_staff ("emailHash");

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS "requesterEmailHash" TEXT,
  ADD COLUMN IF NOT EXISTS "requesterEmailEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "requesterIpEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "requesterGeoEncrypted" TEXT;

CREATE INDEX IF NOT EXISTS support_tickets_requester_email_hash_idx
  ON support_tickets ("requesterEmailHash");

ALTER TABLE payment_webhook_events
  ADD COLUMN IF NOT EXISTS "payloadEncrypted" TEXT;

ALTER TABLE platform_audit_logs
  ADD COLUMN IF NOT EXISTS "metadataEncrypted" TEXT;
