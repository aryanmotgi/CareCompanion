-- Migration 011 — user_identities table
-- Multi-provider account linking. One row per (user, auth provider) so a single
-- user record can link password + Apple + Google without colliding on the
-- legacy users.cognito_sub column.

CREATE TABLE IF NOT EXISTS user_identities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     text NOT NULL,           -- 'password' | 'apple' | 'google' | 'cognito'
  provider_sub text,                    -- null for password rows
  email        text,
  created_at   timestamptz DEFAULT now()
);

-- Unique (provider, provider_sub) — null subs allowed (multiple password rows
-- per-user are still prevented by the (user_id, provider) index below).
CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_sub_uniq
  ON user_identities (provider, provider_sub);

-- Prevent same user having two identities of the same provider.
CREATE UNIQUE INDEX IF NOT EXISTS user_identities_user_provider_uniq
  ON user_identities (user_id, provider);

-- Speeds up email-based lookup during sign-in conflict checks.
CREATE INDEX IF NOT EXISTS user_identities_email_idx
  ON user_identities (email);
