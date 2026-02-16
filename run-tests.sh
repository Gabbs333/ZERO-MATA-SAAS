#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "  Migration Tests Runner"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo ""
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}⚠️  Dependencies not installed. Running npm install...${NC}"
    npm install
    echo ""
fi

# Check if database is available
echo "Checking database connection..."
if psql "${DATABASE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}" -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
    echo ""
    echo "Running tests..."
    echo ""
    npm test
else
    echo -e "${RED}✗ Database connection failed${NC}"
    echo ""
    echo "To run the tests, you need a PostgreSQL database running."
    echo ""
    echo "Options:"
    echo "  1. Start local Supabase:"
    echo "     ${GREEN}supabase start${NC}"
    echo ""
    echo "  2. Start PostgreSQL with Docker:"
    echo "     ${GREEN}docker run -d -p 54322:5432 -e POSTGRES_PASSWORD=postgres postgres${NC}"
    echo ""
    echo "  3. Use an existing PostgreSQL instance:"
    echo "     Update DATABASE_URL in .env file"
    echo ""
    exit 1
fi
