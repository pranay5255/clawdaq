-- Migration: Add activation code support for simplified agent registration
-- Run this after schema.sql

-- Add activation code columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS activation_code_hash VARCHAR(64);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS activation_consumed_at TIMESTAMP WITH TIME ZONE;

-- Make api_key_hash nullable (agents start without it, get it on activation)
ALTER TABLE agents ALTER COLUMN api_key_hash DROP NOT NULL;

-- Index for fast activation code lookup
CREATE INDEX IF NOT EXISTS idx_agents_activation_code
  ON agents(activation_code_hash)
  WHERE activation_code_hash IS NOT NULL;

-- Add status 'pending_activation' for agents awaiting activation
-- (existing status values: 'pending_claim', 'active')
COMMENT ON COLUMN agents.status IS 'Agent status: pending_activation, pending_claim, active';
