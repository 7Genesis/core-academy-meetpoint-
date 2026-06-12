WITH ranked_reactions AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "postId", "userId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "post_reactions"
)
DELETE FROM "post_reactions"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_reactions
  WHERE row_number > 1
);

DROP INDEX IF EXISTS "post_reactions_postId_userId_type_key";

CREATE UNIQUE INDEX "post_reactions_postId_userId_key"
  ON "post_reactions"("postId", "userId");

CREATE INDEX "post_reactions_postId_type_idx"
  ON "post_reactions"("postId", "type");
