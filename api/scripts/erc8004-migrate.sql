-- ERC-8004 / x402 fields migration for existing databases

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42),
  ADD COLUMN IF NOT EXISTS erc8004_chain_id INTEGER,
  ADD COLUMN IF NOT EXISTS erc8004_agent_id VARCHAR(66),
  ADD COLUMN IF NOT EXISTS erc8004_agent_uri TEXT,
  ADD COLUMN IF NOT EXISTS erc8004_registered_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payer_eoa VARCHAR(42),
  ADD COLUMN IF NOT EXISTS agent0_chain_id INTEGER,
  ADD COLUMN IF NOT EXISTS agent0_agent_id VARCHAR(66),
  ADD COLUMN IF NOT EXISTS agent0_agent_uri TEXT,
  ADD COLUMN IF NOT EXISTS agent0_metadata JSONB,
  ADD COLUMN IF NOT EXISTS reputation_summary JSONB,
  ADD COLUMN IF NOT EXISTS x402_supported BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS x402_tx_hash VARCHAR(66);

CREATE INDEX IF NOT EXISTS idx_agents_erc8004_id ON agents(erc8004_agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_agent0_id ON agents(agent0_agent_id);
