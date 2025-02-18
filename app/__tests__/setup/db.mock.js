const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
    connect: jest.fn()
};

// Create a mock pool that returns a Promise resolving to the mockClient
const mockPool = {
    connect: jest.fn().mockImplementation(() => Promise.resolve(mockClient)),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
};

// Add transaction methods to mockClient
mockClient.query.mockImplementation((query) => {
    if (query === 'BEGIN') {
        return Promise.resolve({ rows: [] });
    }
    if (query === 'COMMIT') {
        return Promise.resolve({ rows: [] });
    }
    if (query === 'ROLLBACK') {
        return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
});

module.exports = mockPool; 