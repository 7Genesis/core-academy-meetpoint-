CREATE TYPE "ContentVisibility" AS ENUM ('PUBLIC');

ALTER TABLE "courses"
ADD COLUMN "visibility" "ContentVisibility" NOT NULL DEFAULT 'PUBLIC';

CREATE INDEX "courses_visibility_createdAt_idx" ON "courses"("visibility", "createdAt");

CREATE TABLE "posts" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "visibility" "ContentVisibility" NOT NULL DEFAULT 'PUBLIC',
  "body" TEXT NOT NULL,
  "mediaUrl" TEXT,
  "mediaType" TEXT,
  "city" TEXT,
  "tag" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "post_comments" (
  "id" UUID NOT NULL,
  "postId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "post_reactions" (
  "id" UUID NOT NULL,
  "postId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'like',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communities" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "visibility" "ContentVisibility" NOT NULL DEFAULT 'PUBLIC',
  "name" TEXT NOT NULL,
  "topic" TEXT,
  "description" TEXT,
  "city" TEXT,
  "imageUrl" TEXT,
  "memberCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_members" (
  "id" UUID NOT NULL,
  "communityId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opportunities" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "visibility" "ContentVisibility" NOT NULL DEFAULT 'PUBLIC',
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "category" TEXT,
  "city" TEXT,
  "salaryLabel" TEXT,
  "description" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opportunity_applications" (
  "id" UUID NOT NULL,
  "opportunityId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "message" TEXT,
  "resumeUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opportunity_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "benefits" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "visibility" "ContentVisibility" NOT NULL DEFAULT 'PUBLIC',
  "title" TEXT NOT NULL,
  "partner" TEXT NOT NULL,
  "category" TEXT,
  "city" TEXT,
  "description" TEXT,
  "pointsCost" INTEGER NOT NULL DEFAULT 0,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "benefit_redemptions" (
  "id" UUID NOT NULL,
  "benefitId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "benefit_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "events" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "visibility" "ContentVisibility" NOT NULL DEFAULT 'PUBLIC',
  "title" TEXT NOT NULL,
  "organizer" TEXT,
  "mode" TEXT,
  "location" TEXT,
  "startsAt" TIMESTAMP(3),
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "capacity" INTEGER,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_registrations" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "posts_visibility_createdAt_idx" ON "posts"("visibility", "createdAt");
CREATE INDEX "posts_tenantId_createdAt_idx" ON "posts"("tenantId", "createdAt");
CREATE INDEX "posts_authorId_createdAt_idx" ON "posts"("authorId", "createdAt");
CREATE INDEX "post_comments_postId_createdAt_idx" ON "post_comments"("postId", "createdAt");
CREATE INDEX "post_comments_authorId_createdAt_idx" ON "post_comments"("authorId", "createdAt");
CREATE UNIQUE INDEX "post_reactions_postId_userId_type_key" ON "post_reactions"("postId", "userId", "type");
CREATE INDEX "post_reactions_postId_idx" ON "post_reactions"("postId");
CREATE INDEX "post_reactions_userId_idx" ON "post_reactions"("userId");

CREATE INDEX "communities_visibility_createdAt_idx" ON "communities"("visibility", "createdAt");
CREATE INDEX "communities_tenantId_createdAt_idx" ON "communities"("tenantId", "createdAt");
CREATE INDEX "communities_ownerId_createdAt_idx" ON "communities"("ownerId", "createdAt");
CREATE UNIQUE INDEX "community_members_communityId_userId_key" ON "community_members"("communityId", "userId");
CREATE INDEX "community_members_userId_idx" ON "community_members"("userId");

CREATE INDEX "opportunities_visibility_createdAt_idx" ON "opportunities"("visibility", "createdAt");
CREATE INDEX "opportunities_tenantId_createdAt_idx" ON "opportunities"("tenantId", "createdAt");
CREATE INDEX "opportunities_ownerId_createdAt_idx" ON "opportunities"("ownerId", "createdAt");
CREATE UNIQUE INDEX "opportunity_applications_opportunityId_userId_key" ON "opportunity_applications"("opportunityId", "userId");
CREATE INDEX "opportunity_applications_userId_idx" ON "opportunity_applications"("userId");

CREATE INDEX "benefits_visibility_createdAt_idx" ON "benefits"("visibility", "createdAt");
CREATE INDEX "benefits_tenantId_createdAt_idx" ON "benefits"("tenantId", "createdAt");
CREATE INDEX "benefits_ownerId_createdAt_idx" ON "benefits"("ownerId", "createdAt");
CREATE UNIQUE INDEX "benefit_redemptions_benefitId_userId_key" ON "benefit_redemptions"("benefitId", "userId");
CREATE INDEX "benefit_redemptions_userId_idx" ON "benefit_redemptions"("userId");

CREATE INDEX "events_visibility_startsAt_idx" ON "events"("visibility", "startsAt");
CREATE INDEX "events_visibility_createdAt_idx" ON "events"("visibility", "createdAt");
CREATE INDEX "events_tenantId_createdAt_idx" ON "events"("tenantId", "createdAt");
CREATE INDEX "events_ownerId_createdAt_idx" ON "events"("ownerId", "createdAt");
CREATE UNIQUE INDEX "event_registrations_eventId_userId_key" ON "event_registrations"("eventId", "userId");
CREATE INDEX "event_registrations_userId_idx" ON "event_registrations"("userId");

ALTER TABLE "posts" ADD CONSTRAINT "posts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communities" ADD CONSTRAINT "communities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communities" ADD CONSTRAINT "communities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunity_applications" ADD CONSTRAINT "opportunity_applications_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunity_applications" ADD CONSTRAINT "opportunity_applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunity_applications" ADD CONSTRAINT "opportunity_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "benefits" ADD CONSTRAINT "benefits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "benefit_redemptions" ADD CONSTRAINT "benefit_redemptions_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "benefit_redemptions" ADD CONSTRAINT "benefit_redemptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "benefit_redemptions" ADD CONSTRAINT "benefit_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
