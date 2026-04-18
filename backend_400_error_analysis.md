# BACKEND 400 ERROR CONDITIONS ANALYSIS

## ALL POSSIBLE 400 ERROR CONDITIONS IN /api/attempts/start

### 1. VALIDATION ERRORS (express-validator)
- **Missing examId**: `body('examId').notEmpty()`
- **Empty examId**: `body('examId').notEmpty()`
- **Invalid request body format**: Not JSON or malformed

### 2. BUSINESS LOGIC ERRORS
- **Active attempt exists**: Student already has an attempt with status 'in_progress'
- **Exam not found**: Exam ID doesn't exist in database (returns 404, not 400)
- **User not student**: Auth middleware prevents non-students (returns 401, not 400)

### 3. POTENTIAL ISSUES (currently disabled)
- **Exam not started**: Check if current time < exam.start_time
- **Exam expired**: Check if current time > exam.end_time
- **Student not enrolled**: Check if student is enrolled in exam's course

### CURRENT CODE ANALYSIS:

```typescript
// 400 CONDITIONS:
1. if (!errors.isEmpty()) // Validation errors
2. if (attempt.status === 'in_progress') // Active attempt exists

// 404 CONDITIONS:
3. if (examCheck.rows.length === 0) // Exam not found

// 401 CONDITIONS:
4. requireStudent middleware // User not student
5. auth middleware // No valid token
```

## MOST LIKELY CAUSES:

1. **Validation failure** - examId field missing or empty
2. **Active attempt exists** - Student already started this exam
3. **Request body parsing issue** - express.json() not working
4. **CORS/middleware issue** - Request not reaching controller

## DEBUGGING STEPS:

1. Check if request body is being parsed correctly
2. Verify examId value and type
3. Check if student already has active attempt
4. Verify auth middleware is working
