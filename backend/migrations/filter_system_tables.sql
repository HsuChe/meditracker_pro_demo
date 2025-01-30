-- Add operator types to existing enum if not exists
DO $$ 
BEGIN
    -- Create string operator type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'string_operator') THEN
        CREATE TYPE string_operator AS ENUM (
            'equals', 'notEquals', 'contains', 'doesNotContain', 
            'startsWith', 'endsWith', 'matchesRegex', 'isIn', 
            'isNotIn', 'isNull', 'isNotNull'
        );
    END IF;

    -- Create date operator type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'date_operator') THEN
        CREATE TYPE date_operator AS ENUM (
            'equals', 'before', 'after', 'between', 
            'isNull', 'isNotNull', 'daysSince'
        );
    END IF;

    -- Create numeric operator type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'numeric_operator') THEN
        CREATE TYPE numeric_operator AS ENUM (
            'equals', 'notEquals', 'greaterThan', 'lessThan',
            'greaterThanEquals', 'lessThanEquals', 'between',
            'isIn', 'isNotIn', 'isNull', 'isNotNull',
            'percentageOfTotal'
        );
    END IF;
END $$;

-- Alter saved_filters table
ALTER TABLE saved_filters
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS last_run TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS claims_ids JSONB,
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS run_count INTEGER DEFAULT 0;

-- Add constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_claims_ids'
    ) THEN
        ALTER TABLE saved_filters
        ADD CONSTRAINT valid_claims_ids CHECK (jsonb_typeof(claims_ids) = 'array');
    END IF;
END $$;

-- Create filter_results_history if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'filter_results_history') THEN
        CREATE TABLE filter_results_history (
            history_id SERIAL PRIMARY KEY,
            filter_id INTEGER REFERENCES saved_filters(filter_id),
            run_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            execution_time_ms INTEGER,
            results_count INTEGER,
            conditions_snapshot JSONB,
            error_message TEXT
        );
    END IF;
END $$;

-- Add or update indexes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_filter_name') THEN
        CREATE INDEX idx_filter_name ON saved_filters(name);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_filter_created_at') THEN
        CREATE INDEX idx_filter_created_at ON saved_filters(created_at);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_filter_last_updated') THEN
        CREATE INDEX idx_filter_last_updated ON saved_filters(last_updated);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_filter_results') THEN
        CREATE INDEX idx_filter_results ON filter_results_history(filter_id, run_timestamp);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_claims_ids') THEN
        CREATE INDEX idx_claims_ids ON saved_filters USING GIN (claims_ids);
    END IF;
END $$; 