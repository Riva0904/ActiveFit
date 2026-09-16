-- Turns the legacy shared "gym desk" threads into private 1:1 threads between
-- the member/trainer and their gym's admin. Split from the previous migration
-- on purpose: Postgres refuses to use an enum value in the same transaction
-- that added it.

-- Only one SUPPORT (or leftover GYM) thread per person may exist. The plain
-- unique index cannot enforce that, because NULL peerId compares distinct.
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_gym_user_type_nopeer_key"
  ON "chat_conversations" ("gymId", "userId", "type")
  WHERE "peerId" IS NULL;

-- One admin per gym is the desk's real counterpart. Oldest admin wins, so the
-- choice is stable if a gym has more than one.
WITH desk_admin AS (
  SELECT DISTINCT ON ("gymId") "gymId", "id" AS admin_id
  FROM "users"
  WHERE "role" = 'GYM_ADMIN' AND "gymId" IS NOT NULL AND "isActive" = true
  ORDER BY "gymId", "createdAt" ASC
)
UPDATE "chat_conversations" c
SET
  "type" = 'DIRECT',
  -- Canonical order: the smaller id is always the `userId` side, so a pair has
  -- exactly one row whichever participant opens it.
  "userId"      = LEAST(c."userId", d.admin_id),
  "peerId"      = GREATEST(c."userId", d.admin_id),
  -- unreadUser follows `userId`, unreadAdmin follows `peerId`, so the counters
  -- swap with the ids when the admin sorts first.
  "unreadUser"  = CASE WHEN d.admin_id < c."userId" THEN c."unreadAdmin" ELSE c."unreadUser" END,
  "unreadAdmin" = CASE WHEN d.admin_id < c."userId" THEN c."unreadUser" ELSE c."unreadAdmin" END
FROM desk_admin d
WHERE c."gymId" = d."gymId"
  AND c."type" = 'GYM'
  AND c."userId" <> d.admin_id
  -- Never collide with a thread that already exists for the same pair.
  AND NOT EXISTS (
    SELECT 1 FROM "chat_conversations" x
    WHERE x."gymId" = c."gymId"
      AND x."type" = 'DIRECT'
      AND x."userId" = LEAST(c."userId", d.admin_id)
      AND x."peerId" = GREATEST(c."userId", d.admin_id)
  );
