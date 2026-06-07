-- LGPD privacy consent trail with terms/privacy versions and audit metadata.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_privacy_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "privacyVersion" TEXT NOT NULL,
  "consentType" TEXT NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  "acceptedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  country TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_privacy_consents_user_id_fkey
    FOREIGN KEY ("userId") REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS user_privacy_consents_user_id_idx
  ON user_privacy_consents ("userId");

CREATE INDEX IF NOT EXISTS user_privacy_consents_terms_version_idx
  ON user_privacy_consents ("termsVersion");

CREATE INDEX IF NOT EXISTS user_privacy_consents_privacy_version_idx
  ON user_privacy_consents ("privacyVersion");

CREATE INDEX IF NOT EXISTS user_privacy_consents_consent_type_idx
  ON user_privacy_consents ("consentType");
