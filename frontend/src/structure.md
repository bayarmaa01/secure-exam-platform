# University LMS Frontend Structure

## Overview
Complete React frontend for University Learning Management System with course management, enrollment, exam creation, and student notifications.

## Directory Structure

```
frontend/src/
|
|--- api/
|    |--- courses.ts              # Course management API
|    |--- index.ts                 # Base API configuration
|    |--- notifications.ts         # Notifications API
|
|--- components/
|    |--- ProtectedRoute.tsx       # Route protection wrapper
|
|--- contexts/
|    |--- AuthContext.tsx          # Authentication context
|
|--- pages/
|    |--- Login.tsx                # Login page
|    |--- Register.tsx             # Registration page
|    |--- ForgotPassword.tsx       # Forgot password
|    |--- ResetPassword.tsx        # Reset password
|
|    |--- student/
|    |    |--- StudentDashboard.tsx # Student dashboard with courses & notifications
|    |    |--- ExamList.tsx         # List of available exams
|    |    |--- ExamRoom.tsx         # Exam taking interface
|    |    |--- StudentResults.tsx   # Student results view
|
|    |--- teacher/
|    |    |--- TeacherDashboard.tsx # Teacher dashboard
|    |    |--- Courses.tsx          # Course management (create, delete, enroll)
|    |    |--- CreateExam.tsx       # Exam creation with course selection
|    |    |--- ManageExams.tsx      # Exam management
|    |    |--- AddQuestions.tsx     # Question management (manual + file upload)
|    |    |--- ViewResults.tsx      # Results viewing
|
|    |--- admin/
|    |    |--- AdminDashboard.tsx    # Admin dashboard
|    |    |--- UserManagement.tsx   # User management
|    |    |--- AdminExams.tsx       # Admin exam overview
|    |    |--- AdminResults.tsx     # Admin results
|
|--- App.tsx                       # Main application with routing
|--- main.tsx                      # Application entry point
```

## Key Features Implemented

### Teacher Dashboard
- **Course Management**: Create, view, and delete courses
- **Student Enrollment**: Enroll students by student_id
- **Exam Creation**: Create exams with course selection dropdown
- **Question Management**: 
  - Manual question entry (MCQ, written, coding)
  - File upload support (JSON/CSV)
  - Bulk question import
  - Question deletion

### Student Dashboard
- **Enrolled Courses**: View all enrolled courses
- **Course-Specific Exams**: See exams per course
- **Notifications Panel**: 
  - Real-time notifications
  - Mark as read functionality
  - Unread count indicator
  - Course-based notifications only
- **Statistics**: Enrolled courses, available exams, completed attempts
- **Recent Activity**: Recent exams and attempts

### API Integration
- **Courses API**: Full CRUD operations
- **Enrollment API**: Student enrollment management
- **Questions API**: Manual and file upload
- **Notifications API**: Real-time notifications
- **Exams API**: Course-based exam creation

## Routing Structure

### Public Routes
- `/login` - Login page
- `/register` - Registration page
- `/forgot-password` - Forgot password
- `/reset-password` - Reset password

### Student Routes
- `/dashboard` - Student dashboard (default)
- `/student-dashboard` - Student dashboard (alias)
- `/student/exams` - Available exams
- `/exams` - Available exams (alias)
- `/student/exam/:id` - Take exam
- `/exam/:id` - Take exam (alias)
- `/student/results` - Student results
- `/results` - Student results (alias)

### Teacher Routes
- `/teacher-dashboard` - Teacher dashboard
- `/teacher/courses` - Course management (NEW)
- `/teacher/create-exam` - Create exam (with course selection)
- `/teacher/exams` - Manage exams
- `/teacher/exam/:id/questions` - Manage questions
- `/teacher/results` - View results

## New Components

### Courses.tsx
- Course creation modal
- Course deletion with confirmation
- Student enrollment by student_id
- View enrolled students
- Course statistics (exam count, student count)

### Updated CreateExam.tsx
- Course selection dropdown (required)
- Auto-populated from URL parameter
- Real-time course loading
- Form validation for course selection

### Updated AddQuestions.tsx
- Manual question entry with dynamic options
- File upload support (JSON/CSV)
- Question type selection (MCQ, written, coding)
- Bulk import functionality
- Question deletion

### Updated StudentDashboard.tsx
- Enrolled courses display
- Course-specific exam listing
- Notifications panel with dropdown
- Statistics cards
- Recent activity sections

## API Endpoints Used

### Courses
- `GET /teacher/courses` - Get teacher's courses
- `POST /courses` - Create course
- `DELETE /courses/:id` - Delete course
- `POST /courses/:id/enroll` - Enroll student
- `GET /courses/:id/students` - Get enrolled students
- `GET /student/courses` - Get student's courses

### Questions
- `POST /exams/:id/questions` - Add question manually
- `POST /exams/:id/questions/upload` - Upload questions file
- `GET /exams/:id/questions` - Get exam questions
- `DELETE /questions/:id` - Delete question

### Notifications
- `GET /notifications` - Get user notifications
- `PUT /notifications/:id/read` - Mark as read
- `PUT /notifications/read-all` - Mark all as read

## UI Features

### Course Management
- Responsive grid layout
- Modal-based forms
- Real-time validation
- Loading states
- Error handling

### Question Management
- Dynamic form fields
- File type validation
- Progress indicators
- Format examples

### Student Experience
- Statistics dashboard
- Interactive notifications
- Course-based organization
- Mobile-responsive design

## Development Setup

```bash
cd frontend
npm install
npm run dev
```

## Production Features

- Route protection by role
- Authentication integration
- Error boundaries
- Loading states
- Responsive design
- TypeScript support
- Modern React patterns
