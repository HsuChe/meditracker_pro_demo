# MediTracker Pro Demo

A healthcare claims tracking and management application.

## Deployment to Render

This application is configured for deployment on Render.com with a PostgreSQL database from Neon.

### Prerequisites

1. A Render.com account
2. A Neon.tech account for PostgreSQL database

### Deployment Steps

#### Database Setup (Neon)

1. Create a new PostgreSQL database on Neon.tech
2. Note your connection string, which will look like: `postgres://user:password@hostname:port/database?sslmode=require`

#### Backend Deployment (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use the following settings:
   - **Name**: meditracker-pro-api
   - **Environment**: Node
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && NODE_ENV=production node server.js`
   - **Plan**: Free (or choose a paid plan for production)

4. Add the following environment variables:
   - `NODE_ENV`: production
   - `DATABASE_URL`: Your Neon PostgreSQL connection string
   - `POSTGRES_USER`: Your Neon database username
   - `POSTGRES_HOST`: Your Neon database host
   - `POSTGRES_DATABASE`: Your Neon database name
   - `POSTGRES_PASSWORD`: Your Neon database password
   - `POSTGRES_PORT`: 5432
   - `CLAIMS_TABLE`: claims_dummy
   - `PORT`: 10000 (or let Render assign one)

5. Click "Create Web Service"

### Local Development

#### Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   cd backend && npm install
   ```

3. Create `.env.development` and `.env.test` files based on the provided examples

4. Start the development server:
   ```
   cd backend && npm run dev
   ```

#### Environment Variables

The application uses different environment files based on the `NODE_ENV` setting:
- `.env.development` - For local development
- `.env.test` - For running tests
- `.env.production` - For production deployment

### Database Migration

The application will automatically run migrations on deployment using the `npm run migrate` script.

## Troubleshooting

### Database Connection Issues

If you encounter database connection issues:

1. Verify your Neon database is active and accessible
2. Check that your connection string and credentials are correct
3. Ensure SSL is properly configured (required for Neon)
4. Check the logs in Render for specific error messages

### CORS Issues

If you encounter CORS issues:

1. Add your frontend URL to the CORS configuration in `server.js`
2. Ensure your frontend is making requests to the correct backend URL

## License

ISC 