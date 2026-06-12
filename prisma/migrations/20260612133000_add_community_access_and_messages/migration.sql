CREATE TYPE "CommunityAccessMode" AS ENUM ('PUBLIC', 'INVITE_ONLY', 'PASSWORD');

ALTER TABLE "communities"
ADD COLUMN "accessMode" "CommunityAccessMode" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "inviteCodeHash" TEXT;

CREATE TABLE "community_messages" (
  "id" UUID NOT NULL,
  "communityId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "deletedById" UUID,
  "deletedByAdmin" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "community_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_messages_communityId_createdAt_idx"
ON "community_messages"("communityId", "createdAt");

CREATE INDEX "community_messages_authorId_createdAt_idx"
ON "community_messages"("authorId", "createdAt");

CREATE INDEX "community_messages_tenantId_createdAt_idx"
ON "community_messages"("tenantId", "createdAt");

CREATE INDEX "communities_accessMode_createdAt_idx"
ON "communities"("accessMode", "createdAt");

ALTER TABLE "community_messages"
ADD CONSTRAINT "community_messages_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "communities"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_messages"
ADD CONSTRAINT "community_messages_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_messages"
ADD CONSTRAINT "community_messages_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_messages"
ADD CONSTRAINT "community_messages_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
