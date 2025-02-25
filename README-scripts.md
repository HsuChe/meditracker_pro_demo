# Database Scripts Documentation

## Overview
This document describes the database management scripts created for the MediTracker Pro application. These scripts handle database setup, migrations, seeding, and testing.

## Scripts Directory Structure

```
scripts/
├── setup-local-db.ts    # Local database initialization
├── migrate.ts           # Database migrations
├── seed-dev-data.ts     # Development data seeding
└── test-db.ts          # Database connection testing
```

## Script Details

### 1. Setup Local Database (`setup-local-db.ts`)
**Purpose**: Initializes local development database environment

**Features**:
- Creates database if it doesn't exist
- Sets up required PostgreSQL extensions
- Establishes initial connection
- Handles error cases gracefully

**Usage**:
```bash
npm run setup:local
```

### 2. Database Migration (`migrate.ts`)
**Purpose**: Manages database schema changes

**Features**:
- Environment-aware migrations
- Schema version control
- Reversible migrations
- Error handling and logging

**Usage**:
```bash
# Development
npm run migrate:dev

# Production
npm run migrate:prod
```

### 3. Development Data Seeding (`seed-dev-data.ts`)
**Purpose**: Populates development database with test data

**Seeded Data**:
- Test mappings
- Sample ingestion data
- Dummy claims
- Filter groups and filters

**Usage**:
```bash
npm run seed:dev
```

### 4. Database Testing (`test-db.ts`)
**Purpose**: Verifies database connectivity and schema

**Features**:
- Connection testing
- Table listing
- Basic query verification
- Environment-specific testing

**Usage**:
```bash
npm run test:db
```

## NPM Scripts

```json
{
  "scripts": {
    "setup:local": "tsx scripts/setup-local-db.ts",
    "migrate:dev": "cross-env NODE_ENV=development tsx scripts/migrate.ts",
    "migrate:prod": "cross-env NODE_ENV=production tsx scripts/migrate.ts",
    "seed:dev": "cross-env NODE_ENV=development tsx scripts/seed-dev-data.ts",
    "dev:setup": "npm run setup:local && npm run migrate:dev && npm run seed:dev",
    "dev:fresh": "npm run dev:setup && npm run dev"
  }
}
```

## Dependencies
- @vercel/postgres
- pg (node-postgres)
- dotenv
- cross-env
- tsx

## Error Handling
All scripts include:
- Detailed error messages
- Graceful failure handling
- Environment validation
- Connection timeout handling

## Best Practices
1. Always run setup before development
2. Test migrations locally before production
3. Use seeded data only in development
4. Regular database connection testing
5. Monitor script execution logs

## Troubleshooting
1. Check environment variables
2. Verify PostgreSQL service status
3. Check network connectivity
4. Review script logs
5. Verify database permissions