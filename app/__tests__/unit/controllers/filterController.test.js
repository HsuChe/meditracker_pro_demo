jest.mock('../../../../backend/config/db.config', () => {
    const mockClient = {
        query: jest.fn(),
        release: jest.fn()
    };
    const mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
        query: jest.fn()
    };
    return mockPool;
});

jest.mock('../../../../backend/controllers/claimsController', () => ({
    getClaims: jest.fn()
}));

const pool = require('../../../../backend/config/db.config');
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
    let mockClient;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Get the mock client from the pool's connect method
        mockClient = pool.connect().then(client => client);

        // Setup request and response mocks
        mockReq = {
            body: {},
            query: {},
            params: {}
        };
        mockRes = {
            json: jest.fn(),
            status: jest.fn(() => mockRes)
        };

        // Setup default mock responses
        pool.query.mockImplementation(async (query, params) => {
            if (query.includes('saved_filters')) {
                return { rows: [] };
            }
            return { rows: [] };
        });

        mockClient.then(client => {
            client.query.mockImplementation(async (query, params) => {
                if (query.includes('saved_filters')) {
                    return { rows: [] };
                }
                return { rows: [] };
            });
        });
    });

    describe('getSavedFilters', () => {
        test('should return paginated filters', async () => {
            const mockFilters = [
                { filter_id: 1, name: 'Filter 1' },
                { filter_id: 2, name: 'Filter 2' }
            ];
            pool.query
                .mockResolvedValueOnce({ rows: mockFilters })
                .mockResolvedValueOnce({ rows: [{ count: '2' }] });

            await getSavedFilters(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                filters: mockFilters,
                pagination: expect.any(Object)
            }));
        });

        test('should handle search parameter', async () => {
            mockReq.query.search = 'test';
            pool.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            await getSavedFilters(mockReq, mockRes);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('ILIKE'),
                expect.arrayContaining(['%test%'])
            );
        });
    });

    describe('saveFilter', () => {
        test('should save new filter', async () => {
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

            const client = await mockClient;
            client.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [] }) // name check
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // matching IDs
                .mockResolvedValueOnce({ rows: [{ filter_id: 1 }] }) // insert
                .mockResolvedValueOnce({ rows: [] }); // COMMIT

            await saveFilter(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    filter_id: expect.any(Number)
                })
            );
        });

        test('should reject duplicate filter names', async () => {
            mockReq.body = {
                name: 'Existing Filter',
                conditions: []
            };
            const client = await mockClient;
            client.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [{ filter_id: 1 }] }); // name check

            await saveFilter(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.stringContaining('exists')
                })
            );
        });
    });

    describe('executeFilter', () => {
        test('should execute filter with conditions', async () => {
            const mockConditions = [{
                key: 'Claim Id',
                column: 'claim_id',
                operator: 'equals',
                value: '123'
            }];
            mockReq.body = { conditions: mockConditions };
            const client = await mockClient;
            client.query.mockResolvedValue({ rows: [{ claim_id: '123' }] });

            await executeFilter(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    claims: expect.any(Array),
                    pagination: expect.any(Object)
                })
            );
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
            const client = await mockClient;
            client.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [mockFilter] }) // SELECT query
                .mockResolvedValueOnce({ rows: [] }); // COMMIT

            getClaims.mockResolvedValueOnce({});

            await savedFilterQueryBuilder(1, mockReq, mockRes);

            expect(getClaims).toHaveBeenCalled();
            expect(mockReq.savedFilterQuery).toBeDefined();
            expect(mockReq.savedFilterData).toBeDefined();
        });

        test('should handle non-existent filter', async () => {
            const client = await mockClient;
            client.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [] }); // SELECT query returns no rows

            await savedFilterQueryBuilder(999, mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.stringContaining('not found')
                })
            );
        });
    });

    describe('deleteFilter', () => {
        test('should delete existing filter', async () => {
            mockReq.params.name = 'Test Filter';
            const client = await mockClient;
            client.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [{ filter_id: 1 }] }) // DELETE query
                .mockResolvedValueOnce({ rows: [] }); // COMMIT

            await deleteFilter(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('deleted successfully')
                })
            );
        });

        test('should handle non-existent filter', async () => {
            mockReq.params.name = 'Non-existent Filter';
            const client = await mockClient;
            client.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [] }); // DELETE query returns no rows

            await deleteFilter(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.stringContaining('not found')
                })
            );
        });
    });

    describe('deleteAllFilters', () => {
        test('should delete all filters', async () => {
            const client = await mockClient;
            client.query.mockResolvedValue({ rows: [] });

            await deleteAllFilters(mockReq, mockRes);

            expect(client.query).toHaveBeenCalledWith('DELETE FROM saved_filters');
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('deleted successfully')
                })
            );
        });

        test('should handle database errors', async () => {
            const client = await mockClient;
            client.query.mockRejectedValueOnce(new Error('Database error'));

            await deleteAllFilters(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.stringContaining('Internal server error')
                })
            );
        });
    });
}); 