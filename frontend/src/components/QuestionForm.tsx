import { useState } from 'react'

interface QuestionFormProps {
  examType: string
  onSubmit: (question: any) => void
  onCancel: () => void
}

export default function QuestionForm({ examType, onSubmit, onCancel }: QuestionFormProps) {
  const [formData, setFormData] = useState({
    question_text: '',
    type: examType === 'mixed' ? 'mcq' : examType === 'writing' ? 'short_answer' : examType,
    options: [''],
    correct_answer: '',
    language: 'python',
    starter_code: '',
    test_cases: [{ input: '', output: '' }],
    points: 1
  })

  const getAvailableQuestionTypes = () => {
    if (examType === 'mixed') {
      return [
        { value: 'mcq', label: 'Multiple Choice' },
        { value: 'short_answer', label: 'Short Answer' },
        { value: 'long_answer', label: 'Long Answer' },
        { value: 'coding', label: 'Coding' }
      ]
    }
    
    switch (examType) {
      case 'mcq':
        return [{ value: 'mcq', label: 'Multiple Choice' }]
      case 'writing':
        return [
          { value: 'short_answer', label: 'Short Answer' },
          { value: 'long_answer', label: 'Long Answer' }
        ]
      case 'coding':
        return [{ value: 'coding', label: 'Coding' }]
      default:
        return []
    }
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options]
    newOptions[index] = value
    setFormData({ ...formData, options: newOptions })
  }

  const addOption = () => {
    setFormData({ ...formData, options: [...formData.options, ''] })
  }

  const removeOption = (index: number) => {
    const newOptions = formData.options.filter((_, i) => i !== index)
    setFormData({ ...formData, options: newOptions })
  }

  const handleTestCaseChange = (index: number, field: 'input' | 'output', value: string) => {
    const newTestCases = [...formData.test_cases]
    newTestCases[index][field] = value
    setFormData({ ...formData, test_cases: newTestCases })
  }

  const addTestCase = () => {
    setFormData({ ...formData, test_cases: [...formData.test_cases, { input: '', output: '' }] })
  }

  const removeTestCase = (index: number) => {
    const newTestCases = formData.test_cases.filter((_, i) => i !== index)
    setFormData({ ...formData, test_cases: newTestCases })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate based on question type
    switch (formData.type) {
      case 'mcq':
        if (formData.options.filter(opt => opt.trim()).length < 2) {
          alert('MCQ questions must have at least 2 options')
          return
        }
        if (!formData.correct_answer) {
          alert('MCQ questions must have a correct answer')
          return
        }
        break
        
      case 'short_answer':
      case 'long_answer':
        if (!formData.correct_answer) {
          alert('Writing questions must have a correct answer for grading')
          return
        }
        break
        
      case 'coding':
        if (!formData.language) {
          alert('Coding questions must specify a programming language')
          return
        }
        if (formData.test_cases.filter(tc => tc.input.trim() && tc.output.trim()).length === 0) {
          alert('Coding questions must have at least one test case')
          return
        }
        break
    }

    // Prepare submission data
    const submissionData = {
      ...formData,
      options: formData.type === 'mcq' ? formData.options.filter(opt => opt.trim()) : null,
      starter_code: formData.type === 'coding' ? { [formData.language]: formData.starter_code } : null,
      test_cases: formData.type === 'coding' ? formData.test_cases.filter(tc => tc.input.trim() && tc.output.trim()) : null
    }

    onSubmit(submissionData)
  }

  const renderMCQFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
        {formData.options.map((option, index) => (
          <div key={index} className="flex items-center space-x-2 mb-2">
            <input
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Option ${String.fromCharCode(65 + index)}`}
            />
            {formData.options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addOption}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Option
        </button>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Correct Answer</label>
        <select
          value={formData.correct_answer}
          onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select correct answer</option>
          {formData.options.filter(opt => opt.trim()).map((option, index) => (
            <option key={index} value={option}>
              {String.fromCharCode(65 + index)}: {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  const renderWritingFields = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700">Correct Answer (for grading)</label>
      <textarea
        value={formData.correct_answer}
        onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
        rows={4}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter the correct answer for grading reference"
      />
    </div>
  )

  const renderCodingFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Programming Language</label>
        <select
          value={formData.language}
          onChange={(e) => setFormData({ ...formData, language: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="javascript">JavaScript</option>
          <option value="c">C</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Starter Code (optional)</label>
        <textarea
          value={formData.starter_code}
          onChange={(e) => setFormData({ ...formData, starter_code: e.target.value })}
          rows={6}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder={`def solve():\n    # Your code here\n    pass`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Test Cases</label>
        {formData.test_cases.map((testCase, index) => (
          <div key={index} className="border border-gray-200 rounded p-4 mb-4">
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <label className="block text-xs font-medium text-gray-600">Input</label>
                <input
                  type="text"
                  value={testCase.input}
                  onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                  className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  placeholder="Input for test case"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Expected Output</label>
                <input
                  type="text"
                  value={testCase.output}
                  onChange={(e) => handleTestCaseChange(index, 'output', e.target.value)}
                  className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  placeholder="Expected output"
                />
              </div>
            </div>
            {formData.test_cases.length > 1 && (
              <button
                type="button"
                onClick={() => removeTestCase(index)}
                className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
              >
                Remove Test Case
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addTestCase}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Add Test Case
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Question</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Question Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {getAvailableQuestionTypes().map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Question Text</label>
          <textarea
            value={formData.question_text}
            onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
            rows={3}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your question here..."
          />
        </div>

        {/* Dynamic fields based on question type */}
        {formData.type === 'mcq' && renderMCQFields()}
        {(formData.type === 'short_answer' || formData.type === 'long_answer') && renderWritingFields()}
        {formData.type === 'coding' && renderCodingFields()}

        <div>
          <label className="block text-sm font-medium text-gray-700">Points</label>
          <input
            type="number"
            value={formData.points}
            onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 1 })}
            min="1"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Question
          </button>
        </div>
      </form>
    </div>
  )
}
