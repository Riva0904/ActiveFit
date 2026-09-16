-- Postgres will not let a new enum value be used in the transaction that adds
-- it, so this migration does nothing else.
ALTER TYPE "ChatType" ADD VALUE IF NOT EXISTS 'DIRECT';
