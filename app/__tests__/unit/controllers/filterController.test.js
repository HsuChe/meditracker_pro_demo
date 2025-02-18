jest.mock('../../../../backend/config/db.config', () => {
    const mockClient = {
        query: jest.fn(),
        release: jest.fn()
    };
    const mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
        query: jest.fn()
    };
    return {
        ...mockPool,
        __mockClient: mockClient
    };
});

jest.mock('../../../../backend/controllers/claimsController', () => ({
    getClaims: jest.fn()
}));

const pool = require('../../../../backend/config/db.config');
const mockClient = pool.__mockClient;
const { getClaims } = require('../../../../backend/controllers/claimsController');
const {
    getSavedFilters,
    saveFilter,
    executeFilter,
    savedFilterQueryBuilder,
    deleteFilter,
    deleteAllFilters
} = require('../../../../backend/controllers/filterController');

describe('Filter Controller', () => {
    let mockReq;
    let mockRes;
    let client;

    beforeEach(() => {
        jest.clearAllMocks();
        mockReq = {
            body: {},
            query: {},
            params: {}
        };
        mockRes = {
            json: jest.fn(),
            status: jest.fn(() => mockRes)
        };

        client = {
            query: jest.fn().mockImplementation(async (query, params) => {
                // Basic simulation for transaction control
                if (typeof query === 'string' && query.includes('BEGIN')) {
                    return { rows: [] };
                }
                if (typeof query === 'string' && query.includes('COMMIT')) {
                    return { rows: [] };
                }
                if (typeof query === 'string' && query.includes('ROLLBACK')) {
                    return { rows: [] };
                }
                return { rows: [] };
            }),
            release: jest.fn()
        };

        pool.connect.mockResolvedValue(client);
        pool.query.mockImplementation(async (...args) => client.query(...args));
    });

    describe('getSavedFilters', () => {
        test('should return saved filters array', async () => {
            const mockFilters = [
                { filter_id: 1, name: 'Filter 1' },
                { filter_id: 2, name: 'Filter 2' }
            ];
            // Simulate client query for SELECT * FROM saved_filters ...
            client.query.mockResolvedValueOnce({ rows: mockFilters });

            await getSavedFilters(mockReq, mockRes);

            expect(client.query).toHaveBeenCalledWith(
                'SELECT * FROM saved_filters ORDER BY last_updated DESC'
            );
            // Since getSavedFilters returns validated filters (and validateAndCleanFilter returns same filter in our tests),
            // expect res.json to be called with the filters array.
            expect(mockRes.json).toHaveBeenCalledWith(mockFilters);
        });

        test('should ignore search parameter and return all filters', async () => {
            mockReq.query.search = 'test';
            const mockFilters = [
                { filter_id: 1, name: 'Filter 1' }
            ];
            client.query.mockResolvedValueOnce({ rows: mockFilters });

            await getSavedFilters(mockReq, mockRes);

            // Even if search parameter is provided, the current implementation does not use it.
            expect(client.query).toHaveBeenCalledWith(
                'SELECT * FROM saved_filters ORDER BY last_updated DESC'
            );
            expect(mockRes.json).toHaveBeenCalledWith(mockFilters);
        });

        test('should handle errors and return status 500', async () => {
            client.query.mockRejectedValueOnce(new Error('Test Error'));
            await getSavedFilters(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
        });
    });

    describe('saveFilter', () => {
        test('should save new filter successfully', async () => {
            const mockFilter = {
                name: 'New Filter',
                description: 'Test filter',
                conditions: [{
                    key: 'Claim Id',
                    column: 'claim_id',
                    operator: 'equals',
                    value: '123'
                }]
            };
            mockReq.body = mockFilter;

            // Setup sequence of queries:
            // 1. BEGIN
            client.query.mockResolvedValueOnce({ rows: [] });
            // 2. Name check SELECT returns no duplicate
            client.query.mockResolvedValueOnce({ rows: [] });
            // 3. Matching IDs query: simulation returns two IDs
            client.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
            // 4. INSERT query returns the new filter
            client.query.mockResolvedValueOnce({ rows: [{ filter_id: 1, name: 'New Filter', claims_ids: [1, 2] }] });
            // 5. COMMIT
            client.query.mockResolvedValueOnce({ rows: [] });

            await saveFilter(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    filter_id: expect.any(Number),
                    name: 'New Filter',
                    matched_claims_count: 2
                })
            );
        });

        test('should reject duplicate filter names', async () => {
            mockReq.body = {
                name: 'Existing Filter',
                conditions: []
            };
            // 1. BEGIN
            client.query.mockResolvedValueOnce({ rows: [] });
            // 2. Name check returns duplicate
            client.query.mockResolvedValueOnce({ rows: [{ filter_id: 1 }] });

            await saveFilter(mockReq, mockRes);

            expect(client.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('exists') })
            );
        });
    });

    describe('executeFilter', () => {
        test('should execute filter and return results', async () => {
            // Simulate filter exists
            const fakeFilter = {
                filter_id: 1,
                conditions: [{ column: 'claim_id', operator: 'equals', value: '123' }]
            };
            // 1. BEGIN
            client.query.mockResolvedValueOnce({ rows: [] });
            // 2. SELECT query to get filter
            client.query.mockResolvedValueOnce({ rows: [fakeFilter] });

            // Spy on buildFilterQuery and have it return a dummy query
            const queryBuilder = require('../../../../backend/controllers/queryBuilderController');
            const dummyQuery = 'SELECT * FROM claims_dummy';
            jest.spyOn(queryBuilder, 'buildFilterQuery').mockResolvedValue(dummyQuery);

            // 3. Query using dummyQuery returns a claim
            client.query.mockResolvedValueOnce({ rows: [{ claim_id: 1 }] });
            // 4. COMMIT
            client.query.mockResolvedValueOnce({ rows: [] });

            mockReq.params.filterId = 1;
            await executeFilter(mockReq, mockRes);

            expect(client.query).toHaveBeenCalledWith('SELECT * FROM saved_filters WHERE filter_id = $1', [1]);
            expect(mockRes.json).toHaveBeenCalledWith([{ claim_id: 1 }]);
        });

        test('should handle filter not found', async () => {
            // 1. BEGIN
            client.query.mockResolvedValueOnce({ rows: [] });
            // 2. SELECT returns empty
            client.query.mockResolvedValueOnce({ rows: [] });
            mockReq.params.filterId = 999;

            await executeFilter(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Internal server error',
                details: 'Filter not found'
            });
        });
    });

    describe('savedFilterQueryBuilder', () => {
        test('should build query from saved filter', async () => {
            const mockFilter = {
                conditions: {
                    originalPayload: [{
                        key: 'Claim Id',
                        column: 'claim_id',
                        operator: 'equals',
                        value: '123'
                    }]
                },
                name: 'Test Filter'
            };

            // 1. BEGIN
            client.query.mockResolvedValueOnce({ rows: [] });
            // 2. SELECT query returns filter
            client.query.mockResolvedValueOnce({ rows: [mockFilter] });
            // 3. COMMIT
            client.query.mockResolvedValueOnce({ rows: [] });

            getClaims.mockResolvedValueOnce({ claims: [], pagination: {} });

            await savedFilterQueryBuilder(1, mockReq, mockRes);

            expect(getClaims).toHaveBeenCalled();
            expect(mockReq.savedFilterQuery).toBeDefined();
            expect(mockReq.savedFilterData).toBeDefined();
        });

        test('should handle non-existent filter', async () => {
            // 1. BEGIN
            client.query.mockResolvedValueOnce({ rows: [] });
            // 2. SELECT query returns no rows
            client.query.mockResolvedValueOnce({ rows: [] });

            await savedFilterQueryBuilder(999, mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('not found') })
            );
        });
    });

    describe('deleteFilter', () => {
        test('should delete existing filter', async () => {
            mockReq.params.name = 'Test Filter';

            // 1. BEGIN
            client.query.mockResolvedValueOnce({ rows: [] });
            // 2. DELETE query returns the deleted filter
            client.query.mockResolvedValueOnce({ rows: [{ filter_id: 1, name: 'Test Filter' }] });
            // 3. COMMIT
            client.query.mockResolvedValueOnce({ rows: [] });

            await deleteFilter(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining('deleted successfully') })
            );
        });

        test('should handle non-existent filter', async () => {
            mockReq.params.name = 'Non-existent Filter';

            // 1. BEGIN
            client.query.mockResolvedValueOnce({ rows: [] });
            // 2. DELETE query returns no rows
            client.query.mockResolvedValueOnce({ rows: [] });

            await deleteFilter(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('not found') })
            );
        });
    });

    describe('deleteAllFilters', () => {
        test('should delete all filters', async () => {
            // 1. BEGIN
            client.query.mockResolvedValueOnce({ rows: [] });
            // 2. DELETE all filters
            client.query.mockResolvedValueOnce({ rows: [] });
            // 3. COMMIT
            client.query.mockResolvedValueOnce({ rows: [] });

            await deleteAllFilters(mockReq, mockRes);

            expect(client.query).toHaveBeenCalledWith('DELETE FROM saved_filters');
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining('deleted successfully') })
            );
        });

        test('should handle database errors', async () => {
            // 1. BEGIN
            client.query.mockResolvedValueOnce({ rows: [] });
            // 2. DELETE query fails
            client.query.mockRejectedValueOnce(new Error('Database error'));

            await deleteAllFilters(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('Internal server error') })
            );
        });
    });
}); 