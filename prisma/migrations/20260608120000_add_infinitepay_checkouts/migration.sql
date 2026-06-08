CREATE TABLE "payment_checkouts" (
    "id" UUID NOT NULL,
    "gateway" TEXT NOT NULL,
    "orderNsu" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "EnrollmentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutUrl" TEXT,
    "gatewayCheckoutId" TEXT,
    "transactionNsu" TEXT,
    "receiptUrl" TEXT,
    "payload" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_checkouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_checkouts_orderNsu_key" ON "payment_checkouts"("orderNsu");
CREATE INDEX "payment_checkouts_tenantId_idx" ON "payment_checkouts"("tenantId");
CREATE INDEX "payment_checkouts_userId_idx" ON "payment_checkouts"("userId");
CREATE INDEX "payment_checkouts_courseId_idx" ON "payment_checkouts"("courseId");
CREATE INDEX "payment_checkouts_gateway_idx" ON "payment_checkouts"("gateway");
CREATE INDEX "payment_checkouts_status_idx" ON "payment_checkouts"("status");
CREATE INDEX "payment_checkouts_transactionNsu_idx" ON "payment_checkouts"("transactionNsu");

ALTER TABLE "payment_checkouts" ADD CONSTRAINT "payment_checkouts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_checkouts" ADD CONSTRAINT "payment_checkouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_checkouts" ADD CONSTRAINT "payment_checkouts_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
