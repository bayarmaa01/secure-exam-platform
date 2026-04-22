#!/bin/bash

echo "Applying database migration for exam system upgrade..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if containers are running
if ! docker-compose ps | grep -q "Up"; then
    echo "Error: Docker containers are not running. Please run: docker-compose up -d"
    exit 1
fi

echo "Running migration using Node.js script..."

# Run the migration script
docker-compose exec backend node migrations/run-migration.js

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
    echo "Restarting backend to apply changes..."
    docker-compose restart backend
    echo "Done! The exam system now supports MCQ, Writing, Coding, and Mixed exams."
else
    echo "Migration failed. Please check the error above."
    exit 1
fi
