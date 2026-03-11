import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard'
import ExamList from './pages/student/ExamList'
import ExamRoom from './pages/student/ExamRoom'
import StudentResults from './pages/student/StudentResults'

// Teacher Pages
import TeacherDashboard from './pages/TeacherDashboard'
import CreateExam from './pages/teacher/CreateExam'
import ManageExams from './pages/teacher/ManageExams'
import AddQuestions from './pages/teacher/AddQuestions'
import ViewResults from './pages/teacher/ViewResults'

// Admin Pages
import AdminDashboard from './pages/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import AdminExams from './pages/admin/AdminExams'
import AdminResults from './pages/admin/AdminResults'

function ProtectedRoute({ 
  children, 
  allowedRoles = ['student', 'teacher', 'admin'] 
}: { 
  children: React.ReactNode; 
  allowedRoles?: string[] 
}) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    if (user.role === 'admin') return <Navigate to="/admin-dashboard" replace />
    if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Student Routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/exams" 
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <ExamList />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/exam/:id" 
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <ExamRoom />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/results" 
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentResults />
          </ProtectedRoute>
        } 
      />

      {/* Teacher Routes */}
      <Route 
        path="/teacher/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <TeacherDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/teacher/create-exam" 
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <CreateExam />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/teacher/exams" 
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <ManageExams />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/teacher/exam/:id/questions" 
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <AddQuestions />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/teacher/results" 
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <ViewResults />
          </ProtectedRoute>
        } 
      />

      {/* Admin Routes */}
      <Route 
        path="/admin-dashboard" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/users" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagement />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/exams" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminExams />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/results" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminResults />
          </ProtectedRoute>
        } 
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
