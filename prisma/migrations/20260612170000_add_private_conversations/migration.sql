CREATE TABLE "private_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "firstUserId" UUID NOT NULL,
  "secondUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "private_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "private_conversations_firstUserId_secondUserId_key"
  ON "private_conversations"("firstUserId", "secondUserId");
CREATE INDEX "private_conversations_tenantId_updatedAt_idx"
  ON "private_conversations"("tenantId", "updatedAt");
CREATE INDEX "private_conversations_firstUserId_updatedAt_idx"
  ON "private_conversations"("firstUserId", "updatedAt");
CREATE INDEX "private_conversations_secondUserId_updatedAt_idx"
  ON "private_conversations"("secondUserId", "updatedAt");

ALTER TABLE "private_conversations"
  ADD CONSTRAINT "private_conversations_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "private_conversations"
  ADD CONSTRAINT "private_conversations_firstUserId_fkey"
  FOREIGN KEY ("firstUserId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "private_conversations"
  ADD CONSTRAINT "private_conversations_secondUserId_fkey"
  FOREIGN KEY ("secondUserId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "private_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "senderId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "private_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "private_messages_conversationId_createdAt_idx"
  ON "private_messages"("conversationId", "createdAt");
CREATE INDEX "private_messages_senderId_createdAt_idx"
  ON "private_messages"("senderId", "createdAt");
CREATE INDEX "private_messages_tenantId_createdAt_idx"
  ON "private_messages"("tenantId", "createdAt");

ALTER TABLE "private_messages"
  ADD CONSTRAINT "private_messages_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "private_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "private_messages"
  ADD CONSTRAINT "private_messages_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "private_messages"
  ADD CONSTRAINT "private_messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
