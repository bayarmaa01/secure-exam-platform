# Teacher Login 500 Error - Debug Analysis

## Issue
Teacher login returns 500 Internal Server Error while student login works correctly.

## Potential Causes

### 1. JWT Token Issue
The JWT token generation might be failing for teacher role due to:
- Invalid role data structure
- Encoding issues with teacher-specific fields
- Missing teacher_id field handling

### 2. Database Query Issue
The user query might return inconsistent data for teachers:
- Missing teacher_id field
- Null values in teacher-specific columns
- Data type mismatches

### 3. Password Comparison Issue
bcrypt.compare() might fail on teacher passwords due to:
- Different password hashing format
- Case sensitivity issues
- Special character handling

## Debug Steps

### Backend Code Fixes

1. **Add better error logging in login endpoint:**
```typescript
} catch (err) {
  console.error('Login error details:', {
    email,
    userRole: user?.role,
    error: err.message,
    stack: err.stack
  })
  return res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
}
```

2. **Check user data structure:**
```typescript
console.log('User data from DB:', {
  id: user.id,
  email: user.email,
  role: user.role,
  teacher_id: user.teacher_id,
  student_id: user.student_id
})
```

3. **Validate JWT payload:**
```typescript
const jwtPayload = { userId: user.id, email: user.email, role: user.role }
console.log('JWT Payload:', jwtPayload)
```

### Frontend Debug

1. **Check login request data:**
```javascript
console.log('Login request:', {
  email: "test@teacher.com",
  password: "Test123!@#"
})
```

2. **Verify response handling:**
```javascript
try {
  const result = await authService.login({ email, password })
  console.log('Login success:', result)
} catch (error) {
  console.error('Login error details:', {
    status: error.response?.status,
    data: error.response?.data,
    message: error.message
  })
}
```

## Test Scenarios

1. **Create fresh teacher account:**
   - Email: `debug@teacher.com`
   - Password: `Test123!@#`
   - Role: `teacher`

2. **Test immediate login:**
   - Check if fresh registration works

3. **Test existing teacher login:**
   - Email: `test@teacher.com`
   - Password: `Test123!@#`

## Quick Fix

The most likely issue is that the teacher user record has missing or invalid data. 

**Check database:**
```sql
SELECT * FROM users WHERE email = 'test@teacher.com';
```

**If teacher_id is NULL, update it:**
```sql
UPDATE users SET teacher_id = 'teacher_' || id WHERE email = 'test@teacher.com' AND role = 'teacher';
```

## Next Steps

1. Start Docker Desktop
2. Run debug version with enhanced logging
3. Test teacher login with debug output
4. Fix identified issue
5. Remove debug logging before production
