jest.mock('../../../../backend/config/db.config', () => require('../../setup/db.mock'));

const pool = require('../../../../backend/config/db.config');
const {
    getClaims,
    getClaimsSchema,
    getClaimsDataTypes,
    getDiagnosisCodes
} = require('../../../../backend/controllers/claimsController');

describe('Claims Controller', () => {
    let mockReq;
    let mockRes;
    let mockClient;

    beforeEach(() => {
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        pool.connect.mockResolvedValue(mockClient);

        mockReq = {
            body: {},
            query: {}
        };
        mockRes = {
            json: jest.fn(),
            status: jest.fn(() => mockRes)
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getClaims', () => {
        test('should return empty claims list when no results', async () => {
            mockClient.query.mockResolvedValue({ rows: [] });

            await getClaims(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                claims: [],
                statistics: expect.any(Object),
                pagination: expect.any(Object)
            }));
        });

        test('should handle claims with conditions', async () => {
            const mockRows = [{
                statistics: {
                    uniqueClaimIds: 10,
                    totalRecords: 20,
                    dateRange: { min: '2023-01-01', max: '2023-12-31' },
                    totalAllowedAmount: 5000
                },
                claims: [{ claim_id: '123', amount: 1000 }]
            }];
            mockClient.query.mockResolvedValue({ rows: mockRows });

            mockReq.body.conditions = [{
                column: 'claim_id',
                operator: 'equals',
                value: '123'
            }];

            await getClaims(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                claims: expect.any(Array),
                statistics: expect.any(Object),
                pagination: expect.any(Object)
            }));
        });
    });

    describe('getClaimsSchema', () => {
        test('should return schema information', async () => {
            const mockSchemaRows = [
                { column_name: 'claim_id', data_type: 'text' },
                { column_name: 'amount', data_type: 'numeric' }
            ];
            pool.query.mockResolvedValueOnce({ rows: mockSchemaRows });

            const result = await getClaimsSchema();

            expect(result).toEqual(mockSchemaRows);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('information_schema.columns'),
                expect.any(Array)
            );
        });
    });

    describe('getClaimsDataTypes', () => {
        test('should return mapped data types', async () => {
            const mockSchemaRows = [
                { column_name: 'claim_id', data_type: 'text' },
                { column_name: 'amount', data_type: 'numeric' }
            ];
            pool.query.mockResolvedValueOnce({ rows: mockSchemaRows });

            await getClaimsDataTypes(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        column: expect.any(String),
                        type: expect.any(String)
                    })
                ])
            });
        });

        test('should filter out key column when specified', async () => {
            const mockSchemaRows = [
                { column_name: 'key_col', data_type: 'text' },
                { column_name: 'other_col', data_type: 'numeric' }
            ];
            pool.query.mockResolvedValueOnce({ rows: mockSchemaRows });

            mockReq.query.keyColumn = 'key_col';

            await getClaimsDataTypes(mockReq, mockRes);

            const response = mockRes.json.mock.calls[0][0];
            expect(response.data.length).toBe(1);
            expect(response.data[0].column).toBe('other_col');
        });
    });

    describe('getDiagnosisCodes', () => {
        test('should return error for invalid input', async () => {
            mockReq.body = { ingestedIds: null };

            await getDiagnosisCodes(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(String)
                })
            );
        });

        test('should return grouped diagnosis codes', async () => {
            const mockRows = [
                { diagnosis_code: 'D1', ingested_name: 'Set1', ingested_data_id: 1 },
                { diagnosis_code: 'D2', ingested_name: 'Set1', ingested_data_id: 1 }
            ];
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // verify query
            mockClient.query.mockResolvedValueOnce({ rows: mockRows }); // main query

            mockReq.body = { ingestedIds: [1] };

            await getDiagnosisCodes(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    Set1: expect.objectContaining({
                        diagnosis_codes: expect.arrayContaining(['D1', 'D2'])
                    })
                })
            });
        });
    });
}); 