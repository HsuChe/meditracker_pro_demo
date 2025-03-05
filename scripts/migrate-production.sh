#!/bin/bash

# Set environment to production
export NODE_ENV=production

# Install dependencies if needed
npm install

# Run the migration script
npx ts-node scripts/migrate.ts

echo "Production database migration completed!" 