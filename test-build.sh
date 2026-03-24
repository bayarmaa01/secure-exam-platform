#!/bin/bash

echo "🧪 Testing Build Process for All Services"
echo "=========================================="

# Test Backend
echo ""
echo "🔧 Testing Backend Build..."
cd backend
npm install
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Backend build successful"
else
    echo "❌ Backend build failed"
    exit 1
fi

# Test Frontend
echo ""
echo "🎨 Testing Frontend Build..."
cd ../frontend
npm install
npm run lint
if [ $? -eq 0 ]; then
    echo "✅ Frontend lint successful"
else
    echo "❌ Frontend lint failed"
    exit 1
fi

npm run build
if [ $? -eq 0 ]; then
    echo "✅ Frontend build successful"
else
    echo "❌ Frontend build failed"
    exit 1
fi

# Test AI Proctoring
echo ""
echo "🤖 Testing AI Proctoring..."
cd ../ai-proctoring
pip install -r requirements.txt
if [ $? -eq 0 ]; then
    echo "✅ AI proctoring dependencies installed"
else
    echo "❌ AI proctoring dependencies failed"
    exit 1
fi

# Test free AI
python main-free.py &
AI_PID=$!
sleep 3
curl -s http://localhost:5000/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Free AI service running"
    kill $AI_PID
else
    echo "❌ Free AI service failed"
    kill $AI_PID 2>/dev/null
fi

echo ""
echo "🎉 All tests completed successfully!"
echo "Ready for deployment!"
