import { checkConnection, getTableNames, query } from '@/lib/db';
import { resetTestDb, cleanupTestDb } from '../../helpers/db';

describe('Database Connection Tests', () => {
  beforeAll(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  it('should connect to the database', async () => {
    const isConnected = await checkConnection();
    expect(isConnected).toBe(true);
  });

  it('should execute a simple query', async () => {
    const result = await query('SELECT 1 as number');
    expect(result.rows[0].number).toBe(1);
  });

  it('should list database tables', async () => {
    const tables = await getTableNames();
    expect(Array.isArray(tables)).toBe(true);
    expect(tables.length).toBeGreaterThan(0);
    
    // Verify required test tables exist
    const tableNames = tables.map(t => t.table_name);
    expect(tableNames).toContain('test_transactions');
  });
});