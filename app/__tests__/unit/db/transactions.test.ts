import { executeTransaction, query } from '@/lib/db';
import { resetTestDb, cleanupTestDb, getTestClient } from '../../helpers/db';
import type { QueryConfig } from 'pg';

describe('Database Transaction Tests', () => {
  beforeAll(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  beforeEach(async () => {
    // Clean up test data
    await query('TRUNCATE test_transactions RESTART IDENTITY');
  });

  it('should successfully execute multiple queries in a transaction', async () => {
    const queries: QueryConfig[] = [
      {
        text: 'INSERT INTO test_transactions (value) VALUES ($1) RETURNING id',
        values: ['test1']
      },
      {
        text: 'INSERT INTO test_transactions (value) VALUES ($1) RETURNING id',
        values: ['test2']
      }
    ];

    const results = await executeTransaction(queries);
    expect(results.length).toBe(2);
    expect(results[0].rows[0].id).toBe(1);
    expect(results[1].rows[0].id).toBe(2);

    const finalResult = await query('SELECT COUNT(*) FROM test_transactions');
    expect(parseInt(finalResult.rows[0].count)).toBe(2);
  });

  it('should rollback transaction on error', async () => {
    const queries: QueryConfig[] = [
      {
        text: 'INSERT INTO test_transactions (value) VALUES ($1) RETURNING id',
        values: ['test1']
      },
      {
        text: 'INSERT INTO test_transactions (invalid_column) VALUES ($1)',
        values: ['test2']
      }
    ];

    try {
      await executeTransaction(queries);
      fail('Transaction should have failed');
    } catch (error: any) {
      const result = await query('SELECT COUNT(*) FROM test_transactions');
      expect(parseInt(result.rows[0].count)).toBe(0);
    }
  });

  it('should handle empty transaction', async () => {
    const results = await executeTransaction([]);
    expect(results).toEqual([]);
  });

  it('should handle transaction with single query', async () => {
    const queries: QueryConfig[] = [{
      text: 'INSERT INTO test_transactions (value) VALUES ($1) RETURNING id',
      values: ['single']
    }];

    const results = await executeTransaction(queries);
    expect(results.length).toBe(1);
    expect(results[0].rows[0].id).toBe(1);
  });

  it('should maintain transaction isolation', async () => {
    // Get a dedicated client for the transaction
    const client = await getTestClient();
    
    try {
      // Start a transaction
      await client.query('BEGIN');
      await client.query('INSERT INTO test_transactions (value) VALUES ($1)', ['isolated']);
      
      // Data should be visible within the transaction
      const withinTx = await client.query('SELECT COUNT(*) FROM test_transactions');
      expect(parseInt(withinTx.rows[0].count)).toBe(1);
      
      // Rollback the transaction
      await client.query('ROLLBACK');
      
      // Data should not be visible after rollback
      const afterRollback = await query('SELECT COUNT(*) FROM test_transactions');
      expect(parseInt(afterRollback.rows[0].count)).toBe(0);
    } finally {
      await client.end();
    }
  });
});