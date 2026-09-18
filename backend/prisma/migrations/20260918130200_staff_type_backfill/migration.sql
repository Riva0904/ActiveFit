-- Everyone defaults to FRONT_DESK, which matches what Role.STAFF meant until
-- now. Only rows whose free-text designation or department already says they
-- clean are moved over — guessing wider would silently take the desk away from
-- someone who needs it.
UPDATE "staffs"
SET "staffType" = 'CLEANING'
WHERE "staffType" = 'FRONT_DESK'
  AND (
    COALESCE("designation", '') ILIKE '%clean%'
    OR COALESCE("designation", '') ILIKE '%housekeep%'
    OR COALESCE("designation", '') ILIKE '%janitor%'
    OR COALESCE("department", '') ILIKE '%clean%'
    OR COALESCE("department", '') ILIKE '%housekeep%'
  );
