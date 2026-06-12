CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

ALTER TABLE "posts" ADD COLUMN "sharedFromPostId" UUID;

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_sharedFromPostId_fkey"
  FOREIGN KEY ("sharedFromPostId") REFERENCES "posts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "posts_sharedFromPostId_idx" ON "posts"("sharedFromPostId");

CREATE TABLE "user_follows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "followerId" UUID NOT NULL,
  "followingId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_follows_followerId_followingId_key"
  ON "user_follows"("followerId", "followingId");
CREATE INDEX "user_follows_tenantId_createdAt_idx"
  ON "user_follows"("tenantId", "createdAt");
CREATE INDEX "user_follows_followingId_createdAt_idx"
  ON "user_follows"("followingId", "createdAt");

ALTER TABLE "user_follows"
  ADD CONSTRAINT "user_follows_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follows"
  ADD CONSTRAINT "user_follows_followerId_fkey"
  FOREIGN KEY ("followerId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follows"
  ADD CONSTRAINT "user_follows_followingId_fkey"
  FOREIGN KEY ("followingId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "friend_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "requesterId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "friend_requests_requesterId_recipientId_key"
  ON "friend_requests"("requesterId", "recipientId");
CREATE INDEX "friend_requests_tenantId_status_createdAt_idx"
  ON "friend_requests"("tenantId", "status", "createdAt");
CREATE INDEX "friend_requests_recipientId_status_createdAt_idx"
  ON "friend_requests"("recipientId", "status", "createdAt");
CREATE INDEX "friend_requests_requesterId_status_createdAt_idx"
  ON "friend_requests"("requesterId", "status", "createdAt");

ALTER TABLE "friend_requests"
  ADD CONSTRAINT "friend_requests_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friend_requests"
  ADD CONSTRAINT "friend_requests_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friend_requests"
  ADD CONSTRAINT "friend_requests_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "social_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "actorId" UUID,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "social_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "social_notifications_recipientId_read_createdAt_idx"
  ON "social_notifications"("recipientId", "read", "createdAt");
CREATE INDEX "social_notifications_tenantId_createdAt_idx"
  ON "social_notifications"("tenantId", "createdAt");

ALTER TABLE "social_notifications"
  ADD CONSTRAINT "social_notifications_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_notifications"
  ADD CONSTRAINT "social_notifications_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_notifications"
  ADD CONSTRAINT "social_notifications_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
