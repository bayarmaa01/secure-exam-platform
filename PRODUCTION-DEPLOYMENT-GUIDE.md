# Production Deployment Guide - Database Schema Fixes

## 🚨 Critical Issues Fixed

The production environment is experiencing database constraint violations and API errors. This guide provides step-by-step instructions to fix these issues.

## 📋 Issues Being Fixed

1. **500 Internal Server Error** on `/api/grading/pending` - Missing database columns
2. **500 Internal Server Error** on `/api/proctoring/session/start` - Missing database tables
3. **400 Bad Request** on `/api/proctoring/track` - Violation tracking issues
4. **500 Internal Server Error** on `/api/attempts/submit` - Constraint violation for `pending_review` status

## 🔧 Step-by-Step Deployment

### Step 1: Access the Production Environment

```bash
# SSH into the production server
ssh azureuser@project

# Navigate to the project directory
cd ~/secure-exam-platform
```

### Step 2: Run the Database Schema Fix

```bash
# Execute the production fix script
docker exec secure-exam-platform_backend_1 node backend/production-fix.js
```

**Expected Output:**
```
🚀 Starting production fixes...

🔧 Fix 1: Database constraint for pending_review status
✅ Dropped existing constraint
✅ Added updated constraint with all statuses

🔧 Fix 2: Ensuring required columns exist
✅ All required columns ensured

🔧 Fix 3: Checking proctoring_violations table
✅ Created proctoring_violations table
✅ Created indexes for proctoring_violations

🧪 Fix 4: Testing the fixes
✅ pending_review status works
✅ Violation tracking works

🔄 Fix 5: Updating existing records
✅ Updated X records to pending_review

🎉 Production fixes completed!
```

### Step 3: Restart the Backend Service

```bash
# Restart the backend container to apply code changes
docker restart secure-exam-platform_backend_1

# Wait for the service to be ready
sleep 10

# Check if the service is running
docker logs secure-exam-platform_backend_1 --tail=10
```

### Step 4: Restart the Frontend Service

```bash
# Restart the frontend container
docker restart secure-exam-platform_frontend_1

# Wait for the service to be ready
sleep 10
```

### Step 5: Verify the Fixes

```bash
# Test the grading API
curl -X GET "https://secure-exam.duckdns.org/api/grading/pending" \
  -H "Authorization: Bearer YOUR_TEACHER_TOKEN"

# Test proctoring session start
curl -X POST "https://secure-exam.duckdns.org/api/proctoring/session/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN" \
  -d '{"attemptId": "test-attempt-id", "examId": "test-exam-id"}'

# Test violation tracking
curl -X POST "https://secure-exam.duckdns.org/api/proctoring/track" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN" \
  -d '{"type": "keyboard_copy_paste", "examId": "test-exam-id", "message": "Test violation"}'
```

## 🎯 Expected Results After Deployment

### ✅ Grading System
- Writing/coding exams show "Pending Review" instead of auto-grading
- Teacher grading dashboard loads without 500 errors
- Manual grading workflow works properly

### ✅ Proctoring System
- Proctoring sessions start without 500 errors
- All violation types track properly (keyboard_copy_paste, copy, paste, right_click)
- Auto-termination works after 3+ violations
- Student notifications show correct violation messages

### ✅ Exam Submission
- Writing/coding exams submit successfully without constraint violations
- Status properly set to "pending_review" or "submitted" as fallback
- No more 500 errors on exam submission

## 🔍 Troubleshooting

### If Database Fix Fails

```bash
# Check database connection
docker exec secure-exam-platform_backend_1 node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'exam_platform',
  user: 'postgres',
  password: 'SecureExamPlatform2024!'
});
pool.query('SELECT NOW()').then(res => console.log('✅ DB Connected:', res.rows[0])).catch(console.error);
"

# Manually run constraint fix
docker exec secure-exam-platform_backend_1 node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'exam_platform',
  user: 'postgres',
  password: 'SecureExamPlatform2024!'
});
pool.query('ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check').then(() => {
  return pool.query('ALTER TABLE exam_attempts ADD CONSTRAINT exam_attempts_status_check CHECK (status IN (\\'in_progress\\', \\'submitted\\', \\'pending_review\\', \\'graded\\', \\'terminated\\'))');
}).then(() => console.log('✅ Constraint fixed')).catch(console.error);
"
```

### If Services Don't Start

```bash
# Check container logs
docker logs secure-exam-platform_backend_1
docker logs secure-exam-platform_frontend_1

# Check container status
docker ps -a

# Restart all services
docker-compose down && docker-compose up -d
```

### If API Errors Persist

```bash
# Check if code changes are applied
docker exec secure-exam-platform_backend_1 ls -la backend/src/routes/attempts-api.js
docker exec secure-exam-platform_backend_1 ls -la backend/src/routes/grading.ts
docker exec secure-exam-platform_backend_1 ls -la backend/src/routes/proctoring.ts

# Rebuild containers if needed
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📊 Verification Checklist

- [ ] Database constraint updated successfully
- [ ] All required columns exist
- [ ] Proctoring violations table created
- [ ] Grading API returns 200 status
- [ ] Proctoring session start returns 200 status
- [ ] Violation tracking returns 200 status
- [ ] Exam submission returns 200 status
- [ ] Writing/coding exams show "Pending Review"
- [ ] Teacher grading dashboard loads
- [ ] Student notifications show correct violation types

## 🚀 Post-Deployment Monitoring

Monitor the following for 24 hours after deployment:

1. **Error Rates**: Check for 500/400 errors in logs
2. **Database Performance**: Monitor constraint violations
3. **User Reports**: Watch for complaints about grading/proctoring
4. **System Logs**: Check backend and frontend logs for issues

## 📞 Emergency Rollback

If critical issues arise:

```bash
# Rollback to previous commit
git checkout PREVIOUS_COMMIT_HASH
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 🎉 Success Indicators

- No 500 errors in browser console
- Grading dashboard loads and shows pending attempts
- Proctoring violations track correctly
- Writing/coding exams submit successfully
- Teacher can grade pending attempts
- Students see correct violation messages

---

**Deployment Status**: Ready for production deployment
**Last Updated**: 2026-04-26
**Version**: 4d835d6
