# Set environment to production
$env:NODE_ENV = "production"

# Print environment variables for debugging
Write-Host "Setting NODE_ENV to: $env:NODE_ENV"
Write-Host "Using .env.production configuration"

# Display the backend URL from the .env.production file
$envFile = Get-Content ".env.production" | Where-Object { $_ -match "NEXT_PUBLIC_BACKEND_URL" }
Write-Host "Backend URL: $envFile"

# Run the Next.js development server
Write-Host "Starting Next.js in production mode..."
npx next dev 