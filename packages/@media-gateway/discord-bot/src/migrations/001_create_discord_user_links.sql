-- Migration: Create discord_user_links table
-- Purpose: Link Discord users to Media Gateway accounts
-- Created: 2025-12-09

-- Create discord_user_links table
CREATE TABLE IF NOT EXISTS discord_user_links (
  discord_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  linked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  preferences JSONB DEFAULT '{"brief_enabled": false, "brief_time": "09:00", "preferred_region": "US"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Foreign key to users table (assumes users table exists)
  CONSTRAINT fk_user_id FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  -- Ensure one-to-one relationship
  CONSTRAINT unique_user_id UNIQUE (user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discord_user_links_user_id
  ON discord_user_links(user_id);

CREATE INDEX IF NOT EXISTS idx_discord_user_links_linked_at
  ON discord_user_links(linked_at);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_discord_user_links_updated_at ON discord_user_links;
CREATE TRIGGER update_discord_user_links_updated_at
  BEFORE UPDATE ON discord_user_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create one_time_link_codes table for secure linking
CREATE TABLE IF NOT EXISTS one_time_link_codes (
  code VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  discord_id VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Indexes
  CONSTRAINT fk_one_time_code_user_id FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_one_time_link_codes_user_id
  ON one_time_link_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_one_time_link_codes_expires_at
  ON one_time_link_codes(expires_at);

-- Add comment for documentation
COMMENT ON TABLE discord_user_links IS 'Links Discord users to Media Gateway user accounts';
COMMENT ON TABLE one_time_link_codes IS 'One-time codes for secure Discord account linking';
