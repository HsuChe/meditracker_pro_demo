import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import path from 'path';

// Load production environment variables
config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

async function seedProductionInitialData() {
  try {
    console.log('Starting to seed initial production data...');

    // Insert default mapping
    const mappingResult = await sql`
      INSERT INTO saved_mappings (name, mappings, is_in_use)
      VALUES (
        'Default Production Mapping',
        '{"claim_id": "claim_id", "patient_id": "patient_id", "diagnosis_code": "diagnosis"}'::jsonb,
        true
      )
      ON CONFLICT (name) 
      DO UPDATE SET 
        mappings = EXCLUDED.mappings,
        is_in_use = EXCLUDED.is_in_use
      RETURNING id;
    `;
    console.log('Created or updated default mapping');

    // Insert default filter group
    const groupResult = await sql`
      INSERT INTO filter_groups (name, description, user_id)
      VALUES (
        'Default Group',
        'Default production filter group',
        'system'
      )
      ON CONFLICT (name) 
      DO UPDATE SET 
        description = EXCLUDED.description,
        user_id = EXCLUDED.user_id
      RETURNING id;
    `;
    console.log('Created or updated default filter group');

    // Insert default lookup table entries
    await sql`
      INSERT INTO lut_entries (
        table_name,
        entry_key,
        entry_value,
        description
      )
      VALUES 
        ('claim_types', 'medical', 'Medical Claim', 'Standard medical claim type'),
        ('claim_types', 'pharmacy', 'Pharmacy Claim', 'Standard pharmacy claim type')
      ON CONFLICT (table_name, entry_key) 
      DO UPDATE SET
        entry_value = EXCLUDED.entry_value,
        description = EXCLUDED.description;
    `;
    console.log('Created or updated default lookup entries');

    console.log('Production initial data seeding completed successfully');
  } catch (error) {
    console.error('Error seeding production data:', error);
    process.exit(1);
  }
}

seedProductionInitialData();