import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api'

export default function CreateExam() {
  useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'mcq',
    durationMinutes: 60,
    difficulty: 'medium',
    totalMarks: 100,
    passingMarks: 50,
    scheduledAt: '',
    startTime: '',
    endTime: '',
    fullscreenRequired: false,
    tabSwitchDetection: false,
    copyPasteBlocked: false,
    cameraRequired: false,
    faceDetectionEnabled: false,
    shuffleQuestions: false,
    shuffleOptions: false,
    assignToAll: true
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await api.post('/exams', formData)
      navigate('/teacher/exams')
    } catch (error) {
      console.error('Failed to create exam:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Create Exam</h1>
            <button
              onClick={() => navigate('/teacher/dashboard')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Exam Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="written">Written</option>
                    <option value="coding">Coding</option>
                    <option value="mixed">Mixed</option>
                    <option value="ai_proctored">AI Proctored</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="480"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({...formData, durationMinutes: parseInt(e.target.value)})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Difficulty</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({...formData, difficulty: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Marks</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.totalMarks}
                    onChange={(e) => setFormData({...formData, totalMarks: parseInt(e.target.value)})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Passing Marks</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.passingMarks}
                    onChange={(e) => setFormData({...formData, passingMarks: parseInt(e.target.value)})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <input
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Scheduled Date</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({...formData, scheduledAt: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="fullscreenRequired"
                      checked={formData.fullscreenRequired}
                      onChange={(e) => setFormData({...formData, fullscreenRequired: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="fullscreenRequired" className="ml-2 text-sm text-gray-700">Require Fullscreen</label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="tabSwitchDetection"
                      checked={formData.tabSwitchDetection}
                      onChange={(e) => setFormData({...formData, tabSwitchDetection: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="tabSwitchDetection" className="ml-2 text-sm text-gray-700">Detect Tab Switching</label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="copyPasteBlocked"
                      checked={formData.copyPasteBlocked}
                      onChange={(e) => setFormData({...formData, copyPasteBlocked: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="copyPasteBlocked" className="ml-2 text-sm text-gray-700">Block Copy/Paste</label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="cameraRequired"
                      checked={formData.cameraRequired}
                      onChange={(e) => setFormData({...formData, cameraRequired: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="cameraRequired" className="ml-2 text-sm text-gray-700">Require Camera</label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="faceDetectionEnabled"
                      checked={formData.faceDetectionEnabled}
                      onChange={(e) => setFormData({...formData, faceDetectionEnabled: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="faceDetectionEnabled" className="ml-2 text-sm text-gray-700">Face Detection</label>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Randomization Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="shuffleQuestions"
                      checked={formData.shuffleQuestions}
                      onChange={(e) => setFormData({...formData, shuffleQuestions: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="shuffleQuestions" className="ml-2 text-sm text-gray-700">Shuffle Questions</label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="shuffleOptions"
                      checked={formData.shuffleOptions}
                      onChange={(e) => setFormData({...formData, shuffleOptions: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="shuffleOptions" className="ml-2 text-sm text-gray-700">Shuffle Options</label>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment Settings</h3>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="assignToAll"
                    checked={formData.assignToAll}
                    onChange={(e) => setFormData({...formData, assignToAll: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="assignToAll" className="ml-2 text-sm text-gray-700">Assign to All Students</label>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
