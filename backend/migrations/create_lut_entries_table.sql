-- Create lut_entries table
CREATE TABLE IF NOT EXISTS lut_entries (
  entry_id SERIAL PRIMARY KEY,
  ingestion_id INTEGER NOT NULL REFERENCES ingested_data(ingested_data_id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 