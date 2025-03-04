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

### Test Environment Setup

The application supports a separate test environment using Render's branch deployments.

#### Setting Up Test Environment on Render

1. Create a `test` branch in your Git repository:
   ```
   git checkout -b test
   git push -u origin test
   ```

2. In the Render dashboard, enable branch deployments for your service:
   - Go to your service settings
   - Enable **Branch Deployments**
   - Add the `test` branch
   
3. Configure environment variables for the test branch:
   - Add branch-specific environment variables
   - Set `NODE_ENV=test`
   - Use a separate test database

#### Using the Test Environment Locally

1. Create a `.env.test` file with the following content:
   ```
   # Test Environment Configuration
   NODE_ENV=test
   NEXT_PUBLIC_BACKEND_URL=https://test-meditracker-pro-demo.onrender.com
   
   # Add other test-specific variables here
   ```

2. To run the frontend with test configuration:
   ```
   # On Windows (PowerShell)
   .\start-test.ps1
   
   # Or using npm
   npm run dev:test
   ```

3. For a complete test environment setup (database migrations, seeding, etc.):
   ```
   npm run setup:test-env
   ```

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
- `.env.local` - For overriding any environment settings locally (highest priority)

#### Testing with Production Backend

To test your local frontend changes against the production backend:

1. Create or modify `.env.local` with the following content:
```
# Override NODE_ENV for local development
NODE_ENV=development

# Use the production backend API
NEXT_PUBLIC_BACKEND_URL=https://meditracker-pro-demo.onrender.com

# Keep other settings from .env.production
```

2. Run the development server as normal:
```
npm run dev
```

This configuration allows you to develop and test frontend changes locally while still connecting to the production backend API.

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

### API Connection Problems

If your frontend can't connect to the backend API:

1. Visit the `/debug` page to test API connections
2. Check the browser console for specific error messages
3. Verify that your environment variables are correctly set
4. Ensure the backend service is running and accessible

## License

ISC 