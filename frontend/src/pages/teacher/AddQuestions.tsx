import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api'
import { Question, QuestionType } from '../../types/exam'

interface ApiError {
  response?: {
    data?: {
      message?: string
    }
  }
}

export default function AddQuestions() {
  const { id } = useParams<{ id: string }>()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    question_text: '',
    type: 'mcq' as QuestionType,
    options: ['', ''],
    correct_answer: '',
    points: 1,
    language: 'python' as 'python' | 'java' | 'javascript' | 'cpp' | 'c',
    starter_code: '',
    test_cases: [{ input: '', output: '' }]
  })

  useEffect(() => {
    if (id) fetchQuestions(id)
  }, [id])

  const fetchQuestions = async (examId: string) => {
    try {
      const response = await api.get(`/exams/${examId}/questions`)
      setQuestions(response.data)
    } catch (error) {
      console.error('Failed to fetch questions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError('')
      const payload = {
        question_text: formData.question_text,
        type: formData.type,
        options: formData.type === 'mcq' ? formData.options.filter(o => o.trim()) : [],
        correct_answer: formData.correct_answer,
        points: formData.points,
        language: formData.type === 'coding' ? formData.language : undefined,
        starter_code: formData.type === 'coding' ? { [formData.language]: formData.starter_code } : undefined,
        test_cases: formData.type === 'coding' ? formData.test_cases.filter(tc => tc.input.trim() && tc.output.trim()) : undefined
      }
      
      await api.post(`/exams/${id}/questions`, payload)
      setSuccess('Question added successfully!')
      setFormData({
        question_text: '',
        type: 'mcq',
        options: ['', ''],
        correct_answer: '',
        points: 1,
        language: 'python',
        starter_code: '',
        test_cases: [{ input: '', output: '' }]
      })
      setShowAddModal(false)
      fetchQuestions(id!)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: unknown) {
      const apiError = error as ApiError
      const errorMessage = apiError.response?.data?.message || 'Failed to add question'
      setError(errorMessage)
    }
  }

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setError('Please select a file')
      return
    }

    try {
      setError('')
      setUploading(true)
      const formData = new FormData()
      formData.append('file', selectedFile)

      await api.post(`/exams/${id}/questions/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      setSuccess('Questions uploaded successfully!')
      setSelectedFile(null)
      setShowUploadModal(false)
      fetchQuestions(id!)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: unknown) {
      const apiError = error as ApiError
      const errorMessage = apiError.response?.data?.message || 'Failed to upload questions'
      setError(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return
    }

    try {
      setError('')
      await api.delete(`/questions/${questionId}`)
      setSuccess('Question deleted successfully!')
      fetchQuestions(id!)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: unknown) {
      const apiError = error as ApiError
      const errorMessage = apiError.response?.data?.message || 'Failed to delete question'
      setError(errorMessage)
    }
  }

  const updateOptions = (index: number, value: string) => {
    const newOptions = [...formData.options]
    newOptions[index] = value
    setFormData({ ...formData, options: newOptions })
  }

  const addOption = () => {
    setFormData({ ...formData, options: [...formData.options, ''] })
  }

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index)
      setFormData({ ...formData, options: newOptions })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading questions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/teacher/exams" className="text-gray-600 hover:text-gray-900 mr-4">
                &larr; Back to Exams
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Manage Questions</h1>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Question
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Upload File
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Alerts */}
          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {/* Questions List */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Questions ({questions.length})</h2>
            </div>
            <div className="divide-y">
              {questions.map((question) => (
                <div key={question.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {question.type.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          {question.points} points
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium mb-2">{question.question_text}</p>
                      {question.type === 'mcq' && question.options && question.options.length > 0 && (
                        <div className="space-y-1">
                          {question.options.map((option, index) => (
                            <div key={index} className={`text-sm ${option === question.correct_answer ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                              {String.fromCharCode(65 + index)}. {option}
                              {option === question.correct_answer && ' (Correct)'}
                            </div>
                          ))}
                        </div>
                      )}
                      {question.type !== 'mcq' && (
                        <div className="text-sm text-gray-600">
                          <strong>Answer:</strong> {question.correct_answer}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="ml-4 text-red-600 hover:text-red-800"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {questions.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">No questions added yet</div>
                <div className="space-x-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Add First Question
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Upload Questions File
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Question Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Question</h2>
            <form onSubmit={handleAddQuestion}>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Question Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as QuestionType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="long_answer">Long Answer</option>
                    <option value="coding">Coding</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Question *
                  </label>
                  <textarea
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    required
                  />
                </div>

                {formData.type === 'mcq' && (
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Options *
                    </label>
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2 mb-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateOptions(index, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + index)}`}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        {formData.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addOption}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      + Add Option
                    </button>
                  </div>
                )}

                {/* Coding Question Fields */}
                {formData.type === 'coding' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Programming Language *
                      </label>
                      <select
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value as 'python' | 'java' | 'javascript' | 'cpp' | 'c' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                        <option value="javascript">JavaScript</option>
                        <option value="c">C</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Starter Code (optional)
                      </label>
                      <textarea
                        value={formData.starter_code}
                        onChange={(e) => setFormData({ ...formData, starter_code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        rows={6}
                        placeholder={`def solve():\n    # Your code here\n    pass`}
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Test Cases *
                      </label>
                      {formData.test_cases.map((testCase, index) => (
                        <div key={index} className="border border-gray-200 rounded p-3 mb-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Input</label>
                              <input
                                type="text"
                                value={testCase.input}
                                onChange={(e) => {
                                  const newTestCases = [...formData.test_cases]
                                  newTestCases[index].input = e.target.value
                                  setFormData({ ...formData, test_cases: newTestCases })
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                placeholder="Input for test case"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Expected Output</label>
                              <input
                                type="text"
                                value={testCase.output}
                                onChange={(e) => {
                                  const newTestCases = [...formData.test_cases]
                                  newTestCases[index].output = e.target.value
                                  setFormData({ ...formData, test_cases: newTestCases })
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                placeholder="Expected output"
                                required
                              />
                            </div>
                          </div>
                          {formData.test_cases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newTestCases = formData.test_cases.filter((_, i) => i !== index)
                                setFormData({ ...formData, test_cases: newTestCases })
                              }}
                              className="mt-2 text-red-600 hover:text-red-800 text-xs"
                            >
                              Remove Test Case
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, test_cases: [...formData.test_cases, { input: '', output: '' }] })}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        + Add Test Case
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Correct Answer *
                  </label>
                  {formData.type === 'mcq' ? (
                    <select
                      value={formData.correct_answer}
                      onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select correct answer</option>
                      {formData.options.map((option, index) => (
                        <option key={index} value={option}>
                          {String.fromCharCode(65 + index)}. {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <textarea
                      value={formData.correct_answer}
                      onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Points
                  </label>
                  <input
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Upload Questions File</h2>
            <form onSubmit={handleFileUpload}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Select File (JSON or CSV)
                </label>
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <strong>JSON Format:</strong><br />
                  Use JSON array with question objects containing question, type, options, and answer fields
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  <strong>CSV Format:</strong><br />
                  Question,Type,Options,Answer
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
