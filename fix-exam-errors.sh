#!/bin/bash

echo "Fixing exam system errors..."

# Step 1: Apply database migration if not already done
echo "Step 1: Applying database migration..."
docker cp quick-migration.js secure-exam-platform_backend_1:/app/
docker-compose exec backend node /app/quick-migration.js

# Step 2: Restart backend to apply all changes
echo "Step 2: Restarting backend..."
docker-compose restart backend

# Step 3: Wait for backend to be ready
echo "Step 3: Waiting for backend to be ready..."
sleep 10

# Step 4: Test API endpoints
echo "Step 4: Testing API health..."
docker-compose exec backend curl -f http://localhost:4005/health || echo "Backend health check failed"

# Step 5: Check if database migration was applied
echo "Step 5: Verifying database schema..."
docker-compose exec backend node -e "
const { pool } = require('./dist/db.js');
(async () => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = \\'questions\\' AND column_name = \\'language\\'');
    if (result.rows.length > 0) {
      console.log('Database migration applied successfully!');
    } else {
      console.log('Database migration may not have been applied correctly.');
    }
  } catch (e) { 
    console.error('Database check error:', e.message); 
  }
  finally { 
    client.release(); 
  }
})();
"

echo ""
echo "Fix completed! Please:"
echo "1. Clear your browser cache and localStorage"
echo "2. Log out and log back in to get a fresh token"
echo "3. Try loading the exam again"
echo ""
echo "If you still see errors, please check:"
echo "- Are you logged in to the system?"
echo "- Does your browser have a valid accessToken in localStorage?"
echo "- Is the backend running without errors?"
