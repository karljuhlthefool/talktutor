-- Generic invite links support
-- Allows creating invite links without knowing recipient's email

-- Make email and name nullable for unclaimed (generic) invites
ALTER TABLE invited_users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE invited_users ALTER COLUMN name DROP NOT NULL;

-- Add is_generic flag to distinguish generic invites
ALTER TABLE invited_users ADD COLUMN is_generic BOOLEAN DEFAULT FALSE;

-- Add claimed_at to track when a generic invite was claimed
ALTER TABLE invited_users ADD COLUMN claimed_at TIMESTAMPTZ;

-- Remove unique constraint on email (temporarily) to allow NULL emails
-- Note: In Postgres, NULL values are not considered equal, so multiple NULL emails are allowed
-- But we need to ensure email uniqueness when NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_invited_users_email_unique
  ON invited_users(email)
  WHERE email IS NOT NULL;

-- Add note about the flow:
-- 1. Generic invite: is_generic=true, email=NULL, name=NULL, invite_token set
-- 2. When claimed: email/name filled, claimed_at set
-- 3. After magic link: accepted_at set
