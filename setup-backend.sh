#!/bin/bash

# Create backend directory and its structure
mkdir -p backend/{src/{config,api/{routes,controllers},models,services,middleware,utils},tests/{unit,integration},logs}

# Create empty files for configuration
touch backend/.env backend/.env.example backend/server.js backend/package.json

# Create configuration files
touch backend/src/config/{database.js,auth.js}

# Create route files
touch backend/src/api/routes/{auth.routes.js,data.routes.js,etl.routes.js}

# Create controller files
touch backend/src/api/controllers/{auth.controller.js,data.controller.js,etl.controller.js}

# Create model files
touch backend/src/models/{user.model.js,data.model.js}

# Create service files
touch backend/src/services/{auth.service.js,etl.service.js,data.service.js}

# Create middleware files
touch backend/src/middleware/{auth.middleware.js,validation.middleware.js}

# Create utility files
touch backend/src/utils/{logger.js,helpers.js}

# Create README file
touch backend/README.md

# Navigate to backend directory
cd backend

# Initialize package.json with specific values
cat > package.json << EOF
{
  "name": "meditracker-pro-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest --detectOpenHandles",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Install essential dependencies
npm install express@latest \
    dotenv@latest \
    winston@latest \
    cors@latest \
    helmet@latest \
    jsonwebtoken@latest \
    bcryptjs@latest \
    @azure/identity@latest \
    @azure/data-factory@latest \
    @azure/storage-blob@latest \
    @azure/power-bi-embedded@latest \
    @azure/msal-node@latest \
    zod@^3.24.1

# Install development dependencies
npm install --save-dev nodemon@latest \
    jest@latest \
    supertest@latest \
    @types/node@^18 \
    @types/express@latest \
    typescript@^5 \
    ts-node@latest \
    @types/jest@latest

# Create .gitignore file
echo "# Dependencies
node_modules/

# Environment variables
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*

# Testing
coverage/

# Production build
dist/
build/

# OS files
.DS_Store
Thumbs.db

# IDE specific files
.idea/
.vscode/
*.swp
*.swo

# Azure credentials
*.publishsettings
*.azurePubxml" > .gitignore

# Create basic TypeScript configuration
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
EOF

echo "Backend directory structure has been created successfully!"