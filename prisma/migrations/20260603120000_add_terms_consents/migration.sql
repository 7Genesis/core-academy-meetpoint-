-- LGPD consent audit trail for Terms of Use and Privacy Policy acceptance.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS terms_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip TEXT,
  "userAgent" TEXT,
  CONSTRAINT terms_consents_user_id_fkey
    FOREIGN KEY ("userId") REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS terms_consents_user_id_idx
  ON terms_consents ("userId");

CREATE INDEX IF NOT EXISTS terms_consents_terms_version_idx
  ON terms_consents ("termsVersion");
