jest.mock('../../../../backend/config/db.config', () => require('../../setup/db.mock'));

const pool = require('../../../../backend/config/db.config');
const {
    buildWhereClauses,
    buildFilterQuery,
    buildIdQuery,
    extractWhereConditions,
    buildOptimizedCombinedQuery
} = require('../../../../backend/controllers/queryBuilderController');

describe('Query Builder Controller', () => {
    describe('buildWhereClauses', () => {
        test('should handle empty conditions', () => {
            const result = buildWhereClauses([]);
            expect(result).toEqual({
                clauses: [],
                params: []
            });
        });

        test('should handle equals operator', () => {
            const conditions = [{
                column: 'claim_id',
                operator: 'equals',
                value: '12345'
            }];
            const result = buildWhereClauses(conditions);
            expect(result.clauses[0]).toMatch(/claim_id::numeric = \$1::numeric/);
            expect(result.params).toEqual(['12345']);
        });

        test('should handle contains operator', () => {
            const conditions = [{
                column: 'diagnosis_code',
                operator: 'contains',
                value: 'ABC'
            }];
            const result = buildWhereClauses(conditions);
            expect(result.clauses[0]).toMatch(/diagnosis_code::text ILIKE '%' \|\| \$1::text \|\| '%'/);
            expect(result.params).toEqual(['ABC']);
        });

        test('should handle is_null operator', () => {
            const conditions = [{
                column: 'admission_date',
                operator: 'is_null',
                value: null
            }];
            const result = buildWhereClauses(conditions);
            expect(result.clauses[0]).toBe('admission_date IS NULL');
            expect(result.params).toEqual([]);
        });

        test('should handle numeric comparisons', () => {
            const conditions = [{
                column: 'allowed_amount',
                operator: 'greater_than',
                value: 1000
            }];
            const result = buildWhereClauses(conditions);
            expect(result.clauses[0]).toMatch(/allowed_amount::numeric > \$1::numeric/);
            expect(result.params).toEqual([1000]);
        });
    });

    describe('extractWhereConditions', () => {
        test('should extract WHERE clause from query', () => {
            const query = 'SELECT * FROM table WHERE column = 1 ORDER BY id';
            const result = extractWhereConditions(query);
            expect(result).toBe('column = 1');
        });

        test('should return TRUE when no WHERE clause', () => {
            const query = 'SELECT * FROM table';
            const result = extractWhereConditions(query);
            expect(result).toBe('TRUE');
        });
    });

    describe('buildFilterQuery', () => {
        test('should build basic filter query', () => {
            const conditions = [{
                column: 'claim_id',
                operator: 'equals',
                value: '12345'
            }];
            const { query, params } = buildFilterQuery(conditions);
            expect(query).toContain('SELECT');
            expect(query).toContain('GROUP BY c.claim_id');
            expect(params).toEqual(['12345']);
        });

        test('should build query without conditions', () => {
            const { query, params } = buildFilterQuery([]);
            expect(query).toContain('SELECT');
            expect(query).not.toContain('WHERE');
            expect(params).toEqual([]);
        });
    });

    describe('buildIdQuery', () => {
        test('should build query with main conditions only', () => {
            const mainConditions = [{
                column: 'claim_id',
                operator: 'equals',
                value: '12345'
            }];
            const { query, params } = buildIdQuery(mainConditions, []);
            expect(query).toContain('WITH matching_claims');
            expect(query).toContain('WHERE');
            expect(params).toEqual(['12345']);
        });

        test('should build query with main and sub conditions', () => {
            const mainConditions = [{
                column: 'claim_id',
                operator: 'equals',
                value: '12345'
            }];
            const subConditions = [{
                column: 'line_id',
                operator: 'equals',
                value: '1'
            }];
            const { query, params } = buildIdQuery(mainConditions, subConditions);
            expect(query).toContain('EXISTS');
            expect(params).toEqual(['12345', '1']);
        });
    });

    describe('buildOptimizedCombinedQuery', () => {
        test('should build optimized query with statistics', () => {
            const baseQuery = 'SELECT * FROM claims WHERE claim_id = $1';
            const result = buildOptimizedCombinedQuery(baseQuery, [], 10, 0);
            expect(result).toContain('WITH base_stats AS');
            expect(result).toContain('paginated_claims AS');
            expect(result).toContain('json_build_object');
        });
    });
}); 