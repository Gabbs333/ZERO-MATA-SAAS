#!/bin/bash

# Script to start a test database and run ravitaillement tests
# This script provides an easy way to test the ravitaillement functionality

echo "🚀 Starting test database for ravitaillement tests..."
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if PostgreSQL container is already running
if docker ps | grep -q "snackbar-test-db"; then
    echo "✅ Test database is already running"
else
    echo "📦 Starting PostgreSQL container..."
    docker run -d \
        --name snackbar-test-db \
        -p 54322:5432 \
        -e POSTGRES_PASSWORD=postgres \
        postgres:15
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to start PostgreSQL container"
        exit 1
    fi
    
    echo "⏳ Waiting for database to be ready..."
    sleep 5
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=test-key
SUPABASE_SERVICE_ROLE_KEY=test-key
EOF
fi

echo ""
echo "✅ Database is ready!"
echo ""
echo "🧪 Running ravitaillement property-based tests..."
echo ""

# Run the tests
npm test -- tests/ravitaillements/ravitaillements.property.test.ts

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All ravitaillement tests passed!"
else
    echo "❌ Some tests failed. Check the output above for details."
fi

echo ""
echo "💡 To stop the test database, run:"
echo "   docker stop snackbar-test-db && docker rm snackbar-test-db"
echo ""

exit $TEST_EXIT_CODE
