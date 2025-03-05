# Clear Next.js cache to prevent inconsistencies
Write-Output "Cleaning Next.js cache..."
Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

# Set environment variables
Write-Output "Setting up test environment..."
$env:NODE_ENV = "test"

# Read backend URL from .env.test
$envFile = ".\.env.test"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    foreach ($line in $envContent) {
        if ($line -match "^NEXT_PUBLIC_BACKEND_URL=(.*)$") {
            $backendUrl = $matches[1]
            Write-Output "Using backend URL: $backendUrl"
        }
    }
}

# Start Next.js development server
Write-Output "Starting Next.js development server in test mode..."
npx cross-env NODE_ENV=test next dev 