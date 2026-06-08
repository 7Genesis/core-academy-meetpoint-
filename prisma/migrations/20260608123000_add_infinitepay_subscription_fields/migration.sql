ALTER TABLE "subscriptions"
  ADD COLUMN "checkoutAmountCents" INTEGER,
  ADD COLUMN "checkoutBillingCycle" TEXT,
  ADD COLUMN "transactionNsu" TEXT,
  ADD COLUMN "receiptUrl" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "subscriptions_checkout_amount_cents_idx"
  ON "subscriptions"("checkoutAmountCents");

CREATE INDEX IF NOT EXISTS "subscriptions_transaction_nsu_idx"
  ON "subscriptions"("transactionNsu");
