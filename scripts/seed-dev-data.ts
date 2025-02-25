import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import path from 'path';

// Load development environment variables
config({
  path: path.resolve(process.cwd(), '.env.development')
});

async function seedDevData() {
  try {
    console.log('Starting to seed development data...');

    // Insert a test mapping
    const mappingResult = await sql`
      INSERT INTO saved_mappings (name, mappings, is_in_use)
      VALUES (
        'Test Mapping',
        '{"claim_id": "claim_id", "patient_id": "patient_id", "diagnosis_code": "diagnosis"}'::jsonb,
        true
      )
      RETURNING id;
    `;
    const mappingId = mappingResult.rows[0].id;
    console.log('Created test mapping with ID:', mappingId);

    // Insert test ingestion data
    const ingestionResult = await sql`
      INSERT INTO ingested_data (
        name,
        type,
        record_count,
        file_size_bytes,
        mapping_id
      )
      VALUES (
        'Test Import',
        'claims',
        100,
        1024,
        ${mappingId}
      )
      RETURNING ingested_data_id;
    `;
    const ingestionId = ingestionResult.rows[0].ingested_data_id;
    console.log('Created test ingestion with ID:', ingestionId);

    // Insert test claims
    await sql`
      INSERT INTO claims_dummy (
        claim_id,
        patient_id,
        diagnosis_code,
        procedure_code,
        admission_date,
        discharge_date,
        total_charges,
        ingestion_id
      )
      VALUES 
        ('CLM001', 1, 'D123', 'P123', '2024-01-01', '2024-01-05', 1000.00, ${ingestionId}),
        ('CLM002', 2, 'D456', 'P456', '2024-01-02', '2024-01-06', 2000.00, ${ingestionId}),
        ('CLM003', 3, 'D789', 'P789', '2024-01-03', '2024-01-07', 3000.00, ${ingestionId});
    `;
    console.log('Created test claims');

    // Insert test filter groups and filters
    const groupResult = await sql`
      INSERT INTO filter_groups (name, description, user_id)
      VALUES ('Test Group', 'Test filter group', 'test_user')
      RETURNING id;
    `;
    const groupId = groupResult.rows[0].id;
    console.log('Created test filter group with ID:', groupId);

    await sql`
      INSERT INTO filters (
        group_id,
        name,
        description,
        filter_type,
        conditions,
        execution_order
      )
      VALUES (
        ${groupId},
        'Test Filter',
        'Test filter description',
        'claims',
        '{"field": "total_charges", "operator": ">", "value": 1500}'::jsonb,
        1
      );
    `;
    console.log('Created test filter');

    console.log('Development data seeding completed successfully');
  } catch (error) {
    console.error('Error seeding development data:', error);
    process.exit(1);
  }
}

seedDevData();