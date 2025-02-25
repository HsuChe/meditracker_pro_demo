import { query } from '@/lib/db';
import { resetTestDb, cleanupTestDb } from '../../helpers/db';

describe('Database Data Integrity Tests', () => {
  beforeAll(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  beforeEach(async () => {
    await query('TRUNCATE test_transactions RESTART IDENTITY');
  });

  it('should create and verify test tables', async () => {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'test_transactions'
    `);
    expect(result.rows.length).toBe(1);
  });

  it('should handle JSON data types correctly', async () => {
    // Test JSON insertion and retrieval in test_transactions
    const testData = { key: 'value', nested: { foo: 'bar' } };
    
    await query(
      'INSERT INTO test_transactions (value) VALUES ($1)',
      [JSON.stringify(testData)]
    );

    const result = await query(
      'SELECT value FROM test_transactions WHERE value::json->>\'key\' = $1',
      ['value']
    );

    expect(JSON.parse(result.rows[0].value)).toEqual(testData);
  });

  it('should maintain data integrity in transactions', async () => {
    // Insert test data
    await query(
      'INSERT INTO test_transactions (value) VALUES ($1)',
      ['test value 1']
    );

    // Verify data
    const result = await query(
      'SELECT value FROM test_transactions WHERE value = $1',
      ['test value 1']
    );

    expect(result.rows[0].value).toBe('test value 1');
  });

  it('should handle concurrent transactions correctly', async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        query(
          'INSERT INTO test_transactions (value) VALUES ($1) RETURNING id',
          [`concurrent test ${i}`]
        )
      );
    }

    const results = await Promise.all(promises);
    const ids = results.map(r => r.rows[0].id);
    
    // Verify all IDs are unique
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(promises.length);
  });
});