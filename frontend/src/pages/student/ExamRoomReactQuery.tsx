import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
// Note: React Query example - install with: npm install @tanstack/react-query
// import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../api'

interface Question {
  id: string
  text: string
  options: string[]
  type: 'mcq' | 'text'
  points: number
}

interface Exam {
  id: string
  title: string
  description: string
  durationMinutes: number
  scheduledAt: string
  status: string
}

/*
 * REACT QUERY MIGRATION TEMPLATE
 * 
 * This file demonstrates how to migrate ExamRoom.tsx to React Query
 * for better caching, deduplication, and data fetching patterns.
 * 
 * TO USE:
 * 1. Install React Query: npm install @tanstack/react-query
 * 2. Uncomment the imports below
 * 3. Copy the component code to replace ExamRoom.tsx
 * 4. Set up QueryClientProvider in App.tsx
 * 
 * BENEFITS:
 * - Automatic caching and deduplication
 * - Background refetching and stale-while-revalidate
 * - Optimistic updates and mutation handling
 * - Better loading states and error boundaries
 * - DevTools for debugging
 */

// Uncomment these imports after installing @tanstack/react-query
// import { useQuery, useMutation } from '@tanstack/react-query'

// React Query version - BONUS: Migration to React Query for better caching and deduplication
export default function ExamRoomReactQuery() {
  // This is a template - uncomment React Query imports and implement
  console.log('React Query template - install @tanstack/react-query to use this component')
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">React Query Template</h1>
        <p className="text-gray-600 mb-6">
          Install @tanstack/react-query and uncomment the imports to use this component.
        </p>
        <div className="bg-gray-100 p-4 rounded text-left">
          <h3 className="font-bold mb-2">Installation:</h3>
          <code>npm install @tanstack/react-query</code>
          
          <h3 className="font-bold mb-2 mt-4">Setup in App.tsx:</h3>
          <pre>{`import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  )
}`}</pre>
        </div>
      </div>
    </div>
  )
}

/*
// EXAMPLE IMPLEMENTATION (after installing React Query):

export default function ExamRoomReactQuery() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [cheatingWarnings] = useState(0)
  const timerRef = useRef<number | null>(null)
  const isMounted = useRef(true)

  // React Query for exam data - automatic caching and deduplication
  const {
    data: exam,
    isLoading: examLoading,
    error: examError,
    refetch: refetchExam
  } = useQuery({
    queryKey: ['exam', id],
    queryFn: async () => {
      console.log('DEBUG: React Query - Fetching exam data for ID:', id)
      const response = await api.get(\`/exams/\${id}\`)
      return response.data
    },
    enabled: !!id,
    retry: (failureCount: number, error: any) => {
      // Don't retry on 404 errors
      if (error?.response?.status === 404) return false
      return failureCount < 3
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
  })

  // React Query mutation for starting exam attempt
  const startAttemptMutation = useMutation({
    mutationFn: async (examId: string) => {
      console.log('DEBUG: React Query - Starting exam attempt for:', examId)
      const response = await api.post('/attempts/start', { examId })
      return response.data
    },
    onSuccess: (data: any, examId: string) => {
      console.log('DEBUG: React Query - Attempt started successfully:', data.attemptId)
      setTimeLeft(exam?.durationMinutes * 60 || 0)
    },
    onError: (error: any) => {
      console.error('DEBUG: React Query - Failed to start attempt:', error)
    },
  })

  // Submit exam mutation
  const submitExamMutation = useMutation({
    mutationFn: async ({ attemptId, answers, warnings }: {
      attemptId: string
      answers: Record<string, string | string[]>
      warnings: number
    }) => {
      console.log('DEBUG: React Query - Submitting exam:', attemptId)
      const response = await api.post(\`/exams/attempts/\${attemptId}/submit\`, {
        answers,
        cheatingWarnings: warnings
      })
      return response.data
    },
    onSuccess: (data: any, variables: any) => {
      console.log('DEBUG: React Query - Exam submitted successfully')
      navigate(\`/results/\${variables.attemptId}\`)
    },
    onError: (error: any) => {
      console.error('DEBUG: React Query - Failed to submit exam:', error)
    },
  })

  // ... rest of the implementation
}
*/
