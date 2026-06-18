ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "checkoutPaymentMode" TEXT DEFAULT 'one_time';

UPDATE "subscriptions"
SET "checkoutPaymentMode" = 'one_time'
WHERE "checkoutPaymentMode" IS NULL;

CREATE INDEX IF NOT EXISTS "subscriptions_checkout_payment_mode_idx"
  ON "subscriptions"("checkoutPaymentMode");
