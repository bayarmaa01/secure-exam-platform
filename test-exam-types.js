// Test script to verify all exam types work correctly
// This tests MCQ, Writing (short/long answer), and Coding questions

const axios = require('axios');

const API_BASE = 'http://localhost:4005/api';

// Test data for different question types
const testQuestions = {
  mcq: {
    question_text: "What is the capital of France?",
    type: "mcq",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correct_answer: "Paris",
    points: 5
  },
  short_answer: {
    question_text: "What is 2 + 2?",
    type: "short_answer", 
    correct_answer: "4",
    points: 3
  },
  long_answer: {
    question_text: "Explain the concept of photosynthesis in detail.",
    type: "long_answer",
    correct_answer: "Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen...",
    points: 10
  },
  coding: {
    question_text: "Write a function that returns the sum of two numbers.",
    type: "coding",
    language: "python",
    starter_code: {
      python: "def sum_two_numbers(a, b):\n    # Your code here\n    pass"
    },
    test_cases: [
      { input: "2 3", output: "5" },
      { input: "10 20", output: "30" }
    ],
    correct_answer: "def sum_two_numbers(a, b):\n    return a + b",
    points: 8
  }
};

// Test exam types
const testExams = {
  mcq_exam: {
    title: "MCQ Test Exam",
    description: "Test exam with multiple choice questions",
    type: "mcq",
    duration_minutes: 30,
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    difficulty: "easy",
    total_marks: 100,
    passing_marks: 50,
    is_published: true,
    fullscreen_required: false,
    tab_switch_detection: true,
    copy_paste_blocked: true,
    camera_required: false,
    face_detection_enabled: false,
    shuffle_questions: false,
    shuffle_options: false,
    assign_to_all: true,
    assigned_groups: []
  },
  writing_exam: {
    title: "Writing Test Exam", 
    description: "Test exam with writing questions",
    type: "writing",
    duration_minutes: 45,
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    difficulty: "medium",
    total_marks: 100,
    passing_marks: 60,
    is_published: true,
    fullscreen_required: false,
    tab_switch_detection: true,
    copy_paste_blocked: true,
    camera_required: false,
    face_detection_enabled: false,
    shuffle_questions: false,
    shuffle_options: false,
    assign_to_all: true,
    assigned_groups: []
  },
  coding_exam: {
    title: "Coding Test Exam",
    description: "Test exam with coding questions", 
    type: "coding",
    duration_minutes: 60,
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    difficulty: "hard",
    total_marks: 100,
    passing_marks: 70,
    is_published: true,
    fullscreen_required: false,
    tab_switch_detection: true,
    copy_paste_blocked: true,
    camera_required: false,
    face_detection_enabled: false,
    shuffle_questions: false,
    shuffle_options: false,
    assign_to_all: true,
    assigned_groups: []
  },
  mixed_exam: {
    title: "Mixed Test Exam",
    description: "Test exam with all question types",
    type: "mixed", 
    duration_minutes: 90,
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    difficulty: "medium",
    total_marks: 100,
    passing_marks: 60,
    is_published: true,
    fullscreen_required: false,
    tab_switch_detection: true,
    copy_paste_blocked: true,
    camera_required: false,
    face_detection_enabled: false,
    shuffle_questions: false,
    shuffle_options: false,
    assign_to_all: true,
    assigned_groups: []
  }
};

async function testAPI() {
  console.log('=== Testing Unified Exam System ===\n');
  
  // Test authentication first
  let authToken = '';
  try {
    console.log('1. Testing authentication...');
    const authResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'teacher@example.com',
      password: 'password123'
    });
    authToken = authResponse.data.accessToken;
    console.log('   Authentication successful');
  } catch (error) {
    console.log('   Authentication failed, creating test user...');
    try {
      await axios.post(`${API_BASE}/auth/register`, {
        email: 'teacher@example.com',
        password: 'password123',
        name: 'Test Teacher',
        role: 'teacher'
      });
      
      const authResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: 'teacher@example.com',
        password: 'password123'
      });
      authToken = authResponse.data.accessToken;
      console.log('   Test user created and authenticated');
    } catch (registerError) {
      console.log('   Failed to create test user:', registerError.message);
      return;
    }
  }

  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };

  // Test exam creation for each type
  console.log('\n2. Testing exam creation...');
  const createdExams = {};
  
  for (const [examKey, examData] of Object.entries(testExams)) {
    try {
      const response = await axios.post(`${API_BASE}/exams`, examData, { headers });
      createdExams[examKey] = response.data;
      console.log(`   Created ${examKey}: ${response.data.id}`);
    } catch (error) {
      console.log(`   Failed to create ${examKey}:`, error.response?.data?.message || error.message);
    }
  }

  // Test question creation for each type
  console.log('\n3. Testing question creation...');
  const questionTests = [
    { examKey: 'mcq_exam', questionType: 'mcq', questionData: testQuestions.mcq },
    { examKey: 'writing_exam', questionType: 'short_answer', questionData: testQuestions.short_answer },
    { examKey: 'writing_exam', questionType: 'long_answer', questionData: testQuestions.long_answer },
    { examKey: 'coding_exam', questionType: 'coding', questionData: testQuestions.coding },
    { examKey: 'mixed_exam', questionType: 'mcq', questionData: testQuestions.mcq },
    { examKey: 'mixed_exam', questionType: 'short_answer', questionData: testQuestions.short_answer },
    { examKey: 'mixed_exam', questionType: 'coding', questionData: testQuestions.coding }
  ];

  for (const test of questionTests) {
    const exam = createdExams[test.examKey];
    if (!exam) {
      console.log(`   Skipping ${test.questionType} - exam not created`);
      continue;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/exams/${exam.id}/questions`,
        test.questionData,
        { headers }
      );
      console.log(`   Created ${test.questionType} question for ${test.examKey}: ${response.data.id}`);
    } catch (error) {
      console.log(`   Failed to create ${test.questionType} question:`, error.response?.data?.message || error.message);
    }
  }

  // Test exam retrieval
  console.log('\n4. Testing exam retrieval...');
  for (const [examKey, exam] of Object.entries(createdExams)) {
    try {
      const response = await axios.get(`${API_BASE}/exams/${exam.id}/questions`, { headers });
      console.log(`   Retrieved ${examKey}: ${response.data.length} questions`);
      response.data.forEach(q => {
        console.log(`     - ${q.type}: ${q.question_text.substring(0, 50)}...`);
      });
    } catch (error) {
      console.log(`   Failed to retrieve ${examKey}:`, error.response?.data?.message || error.message);
    }
  }

  console.log('\n=== Test Complete ===');
  console.log('All exam types have been tested. Check the results above for any errors.');
}

// Run the test
testAPI().catch(console.error);
