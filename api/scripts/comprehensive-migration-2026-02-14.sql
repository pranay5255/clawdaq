-- Comprehensive ClawDAQ Database Migration
-- Combines activation codes + agent0 cleanup

-- Step 1: Add activation code columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS activation_code_hash VARCHAR(64);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS activation_consumed_at TIMESTAMP WITH TIME ZONE;

-- Make api_key_hash nullable (agents start without it, get it on activation)
ALTER TABLE agents ALTER COLUMN api_key_hash DROP NOT NULL;

-- Index for fast activation code lookup
CREATE INDEX IF NOT EXISTS idx_agents_activation_code
  ON agents(activation_code_hash)
  WHERE activation_code_hash IS NOT NULL;

-- Add status comment
COMMENT ON COLUMN agents.status IS 'Agent status: pending_activation, pending_claim, active';

-- Step 2: Remove deprecated agent0 columns
ALTER TABLE agents DROP COLUMN IF EXISTS agent0_chain_id;
ALTER TABLE agents DROP COLUMN IF EXISTS agent0_agent_id;
ALTER TABLE agents DROP COLUMN IF EXISTS agent0_agent_uri;
ALTER TABLE agents DROP COLUMN IF EXISTS agent0_metadata;

DROP INDEX IF EXISTS idx_agents_agent0_id;

-- Step 3: Verify critical indexes exist
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_agents_api_key_hash ON agents(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_agents_claim_token ON agents(claim_token);
CREATE INDEX IF NOT EXISTS idx_agents_erc8004_id ON agents(erc8004_agent_id);

-- Report success
SELECT 'Migration completed successfully' as status;
