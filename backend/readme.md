# MediTracker Pro Backend

Backend service for MediTracker Pro, handling claims data ingestion and management.

## Setup

### Prerequisites
- Node.js v20.x
- PostgreSQL 14+
- npm

### Local Development Setup

1. Clone the repository and install dependencies:

bash
cd backend
npm install

2. Create a local PostgreSQL database:

sql
CREATE DATABASE claims_db_dummy;


3. Set up your environment variables by copying the example file:

bash
cp .env.example .env


4. Update the `.env` file with your local database credentials:
env
Local Development
DATABASE_URL=postgres://postgres:@localhost:5432/claims_db_dummy
NODE_ENV=development
DB_USER=postgres
DB_HOST=localhost
DB_NAME=claims_db_dummy
DB_PASSWORD=your_password
DB_PORT=5432
PORT=5000


5. Run database migrations:
bash
npm run migrate


6. Start the development server:
bash
npm run dev


The server will be running at `http://localhost:5000`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm run migrate` - Run database migrations
- `npm test` - Run tests (when implemented)

## Deployment to Heroku

1. Create a new Heroku app:
bash
heroku create your-app-name


2. Add PostgreSQL addon:
bash
heroku addons:create heroku-postgresql:hobby-dev


3. Deploy to Heroku:
bash
git push heroku main


The migrations will run automatically during deployment.

## API Endpoints

### Claims Management
- `POST /api/dummy-claims/batch` - Batch insert claims
- `GET /api/dummy-claims` - Get claims with pagination
- `GET /api/dummy-claims/:id` - Get specific claim
- `DELETE /api/dummy-claims/:id` - Delete specific claim

### Ingestion Management
- `GET /api/ingested-data` - Get all ingestions
- `POST /api/ingested-data` - Create new ingestion
- `GET /api/ingested-data/:id` - Get specific ingestion
- `PATCH /api/ingested-data/:id` - Update ingestion status
- `DELETE /api/ingested-data/:id` - Delete ingestion
- `DELETE /api/ingested-data/clear-all` - Clear all ingestions
- `GET /api/ingested-data/deleted-records` - Get deleted records

### Mappings
- `GET /api/mappings` - Get all mappings
- `POST /api/mappings` - Create new mapping

## Database Schema

### claims_dummy
- `id` - SERIAL PRIMARY KEY
- `claim_id` - VARCHAR(50)
- `line_id` - VARCHAR(50)
- ... (other claim fields)
- Unique constraint on (claim_id, line_id)

### ingested_data
- `ingested_data_id` - SERIAL PRIMARY KEY
- `name` - VARCHAR(255)
- `type` - VARCHAR(50)
- `mapping` - JSONB
- ... (other metadata fields)
- Status fields: activity_status, processing_status

### deleted_claims_log
- `log_id` - SERIAL PRIMARY KEY
- `claim_dummy_id` - INTEGER
- `claim_id` - VARCHAR(50)
- `line_id` - VARCHAR(50)
- ... (other tracking fields)

## Error Handling

The API returns standard HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

Error responses include:
json
{
"error": "Error message",
"details": "Detailed error information"
}


## Performance Considerations

- Uses batch processing for large data ingestion
- Implements database indexes for common queries
- Handles pagination for large datasets
- Monitors memory usage during batch operations
- Uses connection pooling for database connections

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

ISC

### Local Development Setup

1. Clone the repository and install dependencies:
```bash
cd backend
npm install
npm install pg-format   # Add this specific dependency
```

2. Create a local PostgreSQL database:
```sql
CREATE DATABASE claims_db_dummy;
```
```

The error should be resolved after:
1. Removing the unused imports from claimControllerDummy.js
2. Making sure pg-format is installed (`npm install pg-format`)

Would you like me to show any other file changes or add more details to the README?
