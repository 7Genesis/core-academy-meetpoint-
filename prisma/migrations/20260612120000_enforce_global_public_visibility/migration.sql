UPDATE "courses" SET "visibility" = 'PUBLIC' WHERE "visibility" <> 'PUBLIC';
UPDATE "posts" SET "visibility" = 'PUBLIC' WHERE "visibility" <> 'PUBLIC';
UPDATE "communities" SET "visibility" = 'PUBLIC' WHERE "visibility" <> 'PUBLIC';
UPDATE "opportunities" SET "visibility" = 'PUBLIC' WHERE "visibility" <> 'PUBLIC';
UPDATE "benefits" SET "visibility" = 'PUBLIC' WHERE "visibility" <> 'PUBLIC';
UPDATE "events" SET "visibility" = 'PUBLIC' WHERE "visibility" <> 'PUBLIC';

ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_visibility_public_only";
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_visibility_public_only";
ALTER TABLE "communities" DROP CONSTRAINT IF EXISTS "communities_visibility_public_only";
ALTER TABLE "opportunities" DROP CONSTRAINT IF EXISTS "opportunities_visibility_public_only";
ALTER TABLE "benefits" DROP CONSTRAINT IF EXISTS "benefits_visibility_public_only";
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_visibility_public_only";

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_visibility_public_only" CHECK ("visibility" = 'PUBLIC');
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_visibility_public_only" CHECK ("visibility" = 'PUBLIC');
ALTER TABLE "communities"
  ADD CONSTRAINT "communities_visibility_public_only" CHECK ("visibility" = 'PUBLIC');
ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_visibility_public_only" CHECK ("visibility" = 'PUBLIC');
ALTER TABLE "benefits"
  ADD CONSTRAINT "benefits_visibility_public_only" CHECK ("visibility" = 'PUBLIC');
ALTER TABLE "events"
  ADD CONSTRAINT "events_visibility_public_only" CHECK ("visibility" = 'PUBLIC');
