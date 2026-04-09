import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Save, Eye, EyeOff } from 'lucide-react'
import api from '../../api'
import toast from 'react-hot-toast'

interface ExamFormData {
  title: string
  description: string
  type: 'mcq' | 'written' | 'coding' | 'mixed' | 'ai_proctored'
  duration_minutes: number
  start_time: string
  end_time: string
  difficulty: 'easy' | 'medium' | 'hard'
  total_marks: number
  passing_marks: number
  is_published: boolean
  
  // Security settings
  fullscreen_required: boolean
  tab_switch_detection: boolean
  copy_paste_blocked: boolean
  camera_required: boolean
  face_detection_enabled: boolean
  
  // Randomization settings
  shuffle_questions: boolean
  shuffle_options: boolean
  
  // Assignment settings
  assign_to_all: boolean
  assigned_groups: string[]
}

interface QuestionFormData {
  question_text: string
  topic: string
  type: 'mcq' | 'written' | 'coding'
  options: string[]
  correct_answer: string
  points: number
  languages: string[]
  test_cases: Array<{ input: string; expected_output: string }>
  template_code: Record<string, string>
}

export default function AdvancedExamCreation() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<QuestionFormData[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ExamFormData>({
    defaultValues: {
      title: '',
      description: '',
      type: 'mcq',
      duration_minutes: 60,
      start_time: '',
      end_time: '',
      difficulty: 'medium',
      total_marks: 100,
      passing_marks: 50,
      is_published: false,
      fullscreen_required: false,
      tab_switch_detection: false,
      copy_paste_blocked: false,
      camera_required: false,
      face_detection_enabled: false,
      shuffle_questions: false,
      shuffle_options: false,
      assign_to_all: true,
      assigned_groups: []
    }
  })

  const examType = watch('type')

  const addQuestion = () => {
    const newQuestion: QuestionFormData = {
      question_text: '',
      topic: '',
      type: examType === 'mixed' ? 'mcq' : examType,
      options: examType === 'mcq' ? ['', '', '', ''] : [],
      correct_answer: '',
      points: 1,
      languages: ['python', 'javascript', 'cpp'],
      test_cases: [],
      template_code: {}
    }
    setQuestions([...questions, newQuestion])
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, field: keyof QuestionFormData, value: any) => {
    const updatedQuestions = [...questions]
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value }
    setQuestions(updatedQuestions)
  }

  const onSubmit = async (data: ExamFormData) => {
    if (questions.length === 0) {
      toast.error('Please add at least one question')
      return
    }

    setIsSubmitting(true)
    try {
      // Create exam
      const examResponse = await api.post('/exams/advanced', data)
      const exam = examResponse.data

      // Add questions
      for (const question of questions) {
        await api.post(`/exams/${exam.id}/questions/advanced`, question)
      }

      toast.success('Exam created successfully!')
      navigate(`/teacher/exams/${exam.id}/questions`)
    } catch (error) {
      toast.error('Failed to create exam')
      console.error('Exam creation error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderQuestionForm = (question: QuestionFormData, index: number) => (
    <div key={index} className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Question {index + 1}</h3>
        <button
          type="button"
          onClick={() => removeQuestion(index)}
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
          <input
            type="text"
            value={question.topic}
            onChange={(e) => updateQuestion(index, 'topic', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., React, Node.js, Database"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
          <select
            value={question.type}
            onChange={(e) => updateQuestion(index, 'type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="mcq">Multiple Choice</option>
            <option value="written">Written</option>
            <option value="coding">Coding</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
          <textarea
            value={question.question_text}
            onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Enter your question here..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
          <input
            type="number"
            value={question.points}
            onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
            max="100"
          />
        </div>

        {question.type === 'mcq' && (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
              {question.options.map((option, optIndex) => (
                <input
                  key={optIndex}
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...question.options]
                    newOptions[optIndex] = e.target.value
                    updateQuestion(index, 'options', newOptions)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  placeholder={`Option ${optIndex + 1}`}
                />
              ))}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
              <select
                value={question.correct_answer}
                onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select correct answer</option>
                {question.options.map((option, optIndex) => (
                  <option key={optIndex} value={option}>
                    Option {optIndex + 1}: {option || '(empty)'}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {question.type === 'coding' && (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Supported Languages</label>
              <div className="flex flex-wrap gap-2">
                {['python', 'javascript', 'cpp', 'java'].map((lang) => (
                  <label key={lang} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={question.languages.includes(lang)}
                      onChange={(e) => {
                        const languages = e.target.checked
                          ? [...question.languages, lang]
                          : question.languages.filter(l => l !== lang)
                        updateQuestion(index, 'languages', languages)
                      }}
                      className="mr-2"
                    />
                    {lang}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Cases</label>
              {question.test_cases.map((testCase, tcIndex) => (
                <div key={tcIndex} className="border border-gray-200 rounded p-3 mb-2">
                  <input
                    type="text"
                    value={testCase.input}
                    onChange={(e) => {
                      const newTestCases = [...question.test_cases]
                      newTestCases[tcIndex].input = e.target.value
                      updateQuestion(index, 'test_cases', newTestCases)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                    placeholder="Input"
                  />
                  <input
                    type="text"
                    value={testCase.expected_output}
                    onChange={(e) => {
                      const newTestCases = [...question.test_cases]
                      newTestCases[tcIndex].expected_output = e.target.value
                      updateQuestion(index, 'test_cases', newTestCases)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Expected Output"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const newTestCases = [...question.test_cases, { input: '', expected_output: '' }]
                  updateQuestion(index, 'test_cases', newTestCases)
                }}
                className="text-blue-500 hover:text-blue-700 text-sm"
              >
                + Add Test Case
              </button>
            </div>
          </>
        )}

        {question.type === 'written' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sample Answer (for reference)</label>
            <textarea
              value={question.correct_answer}
              onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Sample answer for grading reference..."
            />
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Create Advanced Exam</h1>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    {...register('title', { required: 'Title is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Exam title"
                  />
                  {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                  <select
                    {...register('type')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="written">Written</option>
                    <option value="coding">Coding</option>
                    <option value="mixed">Mixed</option>
                    <option value="ai_proctored">AI Proctored</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    {...register('description')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Exam description and instructions"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                  <input
                    {...register('duration_minutes', { required: 'Duration is required' })}
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="480"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    {...register('difficulty')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    {...register('start_time', { required: 'Start time is required' })}
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    {...register('end_time', { required: 'End time is required' })}
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
                  <input
                    {...register('total_marks', { required: 'Total marks is required' })}
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passing Marks</label>
                  <input
                    {...register('passing_marks', { required: 'Passing marks is required' })}
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="1000"
                  />
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Security Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center">
                  <input {...register('fullscreen_required')} type="checkbox" className="mr-2" />
                  Require Fullscreen Mode
                </label>
                <label className="flex items-center">
                  <input {...register('tab_switch_detection')} type="checkbox" className="mr-2" />
                  Detect Tab Switching
                </label>
                <label className="flex items-center">
                  <input {...register('copy_paste_blocked')} type="checkbox" className="mr-2" />
                  Block Copy/Paste
                </label>
                <label className="flex items-center">
                  <input {...register('camera_required')} type="checkbox" className="mr-2" />
                  Require Camera
                </label>
                <label className="flex items-center">
                  <input {...register('face_detection_enabled')} type="checkbox" className="mr-2" />
                  Enable Face Detection
                </label>
              </div>
            </div>

            {/* Randomization Settings */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Randomization Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center">
                  <input {...register('shuffle_questions')} type="checkbox" className="mr-2" />
                  Shuffle Questions
                </label>
                <label className="flex items-center">
                  <input {...register('shuffle_options')} type="checkbox" className="mr-2" />
                  Shuffle Options
                </label>
              </div>
            </div>

            {/* Questions Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Questions</h2>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  <Plus size={20} />
                  Add Question
                </button>
              </div>

              {questions.map((question, index) => renderQuestionForm(question, index))}
              
              {questions.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">No questions added yet. Click "Add Question" to start.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                {showPreview ? <EyeOff size={20} /> : <Eye size={20} />}
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50"
              >
                <Save size={20} />
                {isSubmitting ? 'Creating...' : 'Create Exam'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
