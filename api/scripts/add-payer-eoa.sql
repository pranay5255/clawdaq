-- Add payer_eoa column if it doesn't exist
-- Safe migration that won't fail if column already exists

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'agents'
    AND column_name = 'payer_eoa'
  ) THEN
    ALTER TABLE agents ADD COLUMN payer_eoa VARCHAR(42);
    RAISE NOTICE 'Column payer_eoa added to agents table';
  ELSE
    RAISE NOTICE 'Column payer_eoa already exists';
  END IF;
END $$;

-- Also check and add other potentially missing columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'agents'
    AND column_name = 'agent0_chain_id'
  ) THEN
    ALTER TABLE agents ADD COLUMN agent0_chain_id INTEGER;
    ALTER TABLE agents ADD COLUMN agent0_agent_id VARCHAR(66);
    ALTER TABLE agents ADD COLUMN agent0_agent_uri TEXT;
    ALTER TABLE agents ADD COLUMN agent0_metadata JSONB;
    RAISE NOTICE 'Agent0 columns added to agents table';
  ELSE
    RAISE NOTICE 'Agent0 columns already exist';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'agents'
    AND column_name = 'reputation_summary'
  ) THEN
    ALTER TABLE agents ADD COLUMN reputation_summary JSONB;
    RAISE NOTICE 'Column reputation_summary added to agents table';
  ELSE
    RAISE NOTICE 'Column reputation_summary already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'agents'
    AND column_name = 'x402_supported'
  ) THEN
    ALTER TABLE agents ADD COLUMN x402_supported BOOLEAN DEFAULT false;
    ALTER TABLE agents ADD COLUMN x402_tx_hash VARCHAR(66);
    RAISE NOTICE 'x402 columns added to agents table';
  ELSE
    RAISE NOTICE 'x402 columns already exist';
  END IF;
END $$;
