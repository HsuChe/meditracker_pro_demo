const request = require('supertest');
const express = require('express');
const router = require('../../../../backend/routes/ingestedDataRoutes');
const ingestedDataController = require('../../../../backend/controllers/ingestedDataController');

// Mock the controller functions
jest.mock('../../../../backend/controllers/ingestedDataController');

const app = express();
app.use(express.json());
app.use('/', router);

describe('Ingested Data Routes', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    describe('GET /', () => {
        it('should get all ingested data', async () => {
            const mockData = [{ id: 1, data: 'test' }];
            ingestedDataController.getIngestedData.mockImplementation((req, res) => {
                res.json(mockData);
            });

            const response = await request(app).get('/');
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockData);
            expect(ingestedDataController.getIngestedData).toHaveBeenCalled();
        });
    });

    describe('POST /', () => {
        it('should create new ingested data', async () => {
            const mockData = { id: 1, data: 'new test' };
            ingestedDataController.createIngestedData.mockImplementation((req, res) => {
                res.status(201).json(mockData);
            });

            const response = await request(app)
                .post('/')
                .send({ data: 'test' });
            
            expect(response.status).toBe(201);
            expect(response.body).toEqual(mockData);
            expect(ingestedDataController.createIngestedData).toHaveBeenCalled();
        });
    });

    describe('GET /deleted-records', () => {
        it('should get deleted records', async () => {
            const mockDeletedData = [{ id: 1, deleted: true }];
            ingestedDataController.getDeletedRecords.mockImplementation((req, res) => {
                res.json(mockDeletedData);
            });

            const response = await request(app).get('/deleted-records');
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockDeletedData);
            expect(ingestedDataController.getDeletedRecords).toHaveBeenCalled();
        });
    });

    describe('DELETE /clear-all', () => {
        it('should clear all ingestions', async () => {
            ingestedDataController.clearAllIngestions.mockImplementation((req, res) => {
                res.status(200).json({ message: 'All ingestions cleared' });
            });

            const response = await request(app).delete('/clear-all');
            expect(response.status).toBe(200);
            expect(ingestedDataController.clearAllIngestions).toHaveBeenCalled();
        });
    });

    describe('GET /:id', () => {
        it('should get ingested data by id', async () => {
            const mockData = { id: 1, data: 'specific test' };
            ingestedDataController.getIngestedDataById.mockImplementation((req, res) => {
                res.json(mockData);
            });

            const response = await request(app).get('/1');
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockData);
            expect(ingestedDataController.getIngestedDataById).toHaveBeenCalled();
        });
    });

    describe('PATCH /:id', () => {
        it('should update ingested data status', async () => {
            const mockUpdatedData = { id: 1, status: 'updated' };
            ingestedDataController.updateIngestedDataStatus.mockImplementation((req, res) => {
                res.json(mockUpdatedData);
            });

            const response = await request(app)
                .patch('/1')
                .send({ status: 'updated' });
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockUpdatedData);
            expect(ingestedDataController.updateIngestedDataStatus).toHaveBeenCalled();
        });
    });

    describe('DELETE /:id', () => {
        it('should delete ingestion by id', async () => {
            ingestedDataController.deleteIngestion.mockImplementation((req, res) => {
                res.status(200).json({ message: 'Ingestion deleted' });
            });

            const response = await request(app).delete('/1');
            expect(response.status).toBe(200);
            expect(ingestedDataController.deleteIngestion).toHaveBeenCalled();
        });
    });
}); 