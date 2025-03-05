# Set environment to production
$env:NODE_ENV = "production"

# Display current environment
Write-Host "Running migration for environment: $env:NODE_ENV"

# Install dependencies if needed
npm install

# Run the migration script
npx ts-node scripts/migrate.ts

Write-Host "Production database migration completed!" 