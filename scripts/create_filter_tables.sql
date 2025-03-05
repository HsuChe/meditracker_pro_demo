-- Script to create filter system tables in NeonDB
-- This script creates the saved_filters and filter_results_history tables
-- with the exact structure shown in the database diagram

-- First, check if the tables already exist and drop them if needed
DO $$ 
BEGIN
    -- Drop tables if they exist (with CASCADE to handle dependencies)
    DROP TABLE IF EXISTS filter_results_history CASCADE;
    DROP TABLE IF EXISTS saved_filters CASCADE;
    
    RAISE NOTICE 'Dropped existing tables if they existed';
END $$;

-- Create saved_filters table
CREATE TABLE saved_filters (
    filter_id SERIAL PRIMARY KEY,
    name CHARACTER VARYING(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_run TIMESTAMP WITH TIME ZONE,
    conditions JSONB,
    claims_ids JSONB,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_by CHARACTER VARYING(100),
    run_count INTEGER DEFAULT 0
);

-- Add unique constraint on name
ALTER TABLE saved_filters ADD CONSTRAINT saved_filters_name_key UNIQUE (name);

-- Create filter_results_history table
CREATE TABLE filter_results_history (
    history_id SERIAL PRIMARY KEY,
    filter_id INTEGER REFERENCES saved_filters(filter_id),
    run_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    results_count INTEGER,
    conditions_snapshot JSONB,
    error_message TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_filter_name ON saved_filters(name);
CREATE INDEX idx_filter_created_at ON saved_filters(created_at);
CREATE INDEX idx_filter_last_updated ON saved_filters(last_updated);
CREATE INDEX idx_filter_results ON filter_results_history(filter_id, run_timestamp);
CREATE INDEX idx_claims_ids ON saved_filters USING GIN (claims_ids);

-- Verify tables were created
DO $$
BEGIN
    RAISE NOTICE 'Tables created successfully:';
    RAISE NOTICE '- saved_filters';
    RAISE NOTICE '- filter_results_history';
END $$; 