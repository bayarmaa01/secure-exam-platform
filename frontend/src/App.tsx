import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'

// Version checking and cache busting
const checkVersionAndCache = () => {
  // Check for version mismatch and clear cache if needed
  const checkVersion = async () => {
    try {
      const response = await fetch('/version.json')
      const { version, buildDate } = await response.json()
      
      const storedVersion = localStorage.getItem('appVersion')
      const storedBuildDate = localStorage.getItem('appBuildDate')
      
      // Clear cache if version or build date changed
      if (storedVersion !== version || storedBuildDate !== buildDate) {
        console.log('Version changed, clearing cache...')
        
        // Clear all localStorage in development
        if (import.meta.env.DEV) {
          localStorage.clear()
        } else {
          // In production, only clear auth-related items
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
        }
        
        // Store new version info
        localStorage.setItem('appVersion', version)
        localStorage.setItem('appBuildDate', buildDate)
        
        // Force reload
        window.location.reload()
      }
    } catch (error) {
      console.error('Version check failed:', error)
    }
  }
  
  checkVersion()
  // Check version every 5 minutes
  setInterval(checkVersion, 5 * 60 * 1000)
}

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard'
import ExamList from './pages/student/ExamList'
import ExamRoom from './pages/student/ExamRoom'
import StudentResults from './pages/student/StudentResults'

// Teacher Pages
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import CreateExam from './pages/teacher/CreateExam'
import ManageExams from './pages/teacher/ManageExams'
import AddQuestions from './pages/teacher/AddQuestions'
import ViewResults from './pages/teacher/ViewResults'

// Admin Pages
import AdminDashboard from './pages/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import AdminExams from './pages/admin/AdminExams'
import AdminResults from './pages/admin/AdminResults'

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Student Routes */}
      <Route 
        path="/student-dashboard" 
        element={
          <ProtectedRoute role="student">
            <StudentDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute role="student">
            <StudentDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/student/exams" 
        element={
          <ProtectedRoute role="student">
            <ExamList />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/exams" 
        element={
          <ProtectedRoute role="student">
            <ExamList />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/student/exam/:id" 
        element={
          <ProtectedRoute role="student">
            <ExamRoom />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/exam/:id" 
        element={
          <ProtectedRoute role="student">
            <ExamRoom />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/student/results" 
        element={
          <ProtectedRoute role="student">
            <StudentResults />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/results" 
        element={
          <ProtectedRoute role="student">
            <StudentResults />
          </ProtectedRoute>
        } 
      />

      {/* Teacher Routes */}
      <Route 
        path="/teacher-dashboard" 
        element={
          <ProtectedRoute role="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/teacher/create-exam" 
        element={
          <ProtectedRoute role="teacher">
            <CreateExam />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/teacher/exams" 
        element={
          <ProtectedRoute role="teacher">
            <ManageExams />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/teacher/exam/:id/questions" 
        element={
          <ProtectedRoute role="teacher">
            <AddQuestions />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/teacher/results" 
        element={
          <ProtectedRoute role="teacher">
            <ViewResults />
          </ProtectedRoute>
        } 
      />

      {/* Admin Routes */}
      <Route 
        path="/admin-dashboard" 
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/users" 
        element={
          <ProtectedRoute role="admin">
            <UserManagement />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/exams" 
        element={
          <ProtectedRoute role="admin">
            <AdminExams />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/results" 
        element={
          <ProtectedRoute role="admin">
            <AdminResults />
          </ProtectedRoute>
        } 
      />

      {/* Fallback - redirect based on auth status */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  // Initialize version checking on app load
  checkVersionAndCache()
  
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
