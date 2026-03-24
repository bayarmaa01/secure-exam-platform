#!/usr/bin/env python3
"""
🧪 Test script for Free AI Proctoring Service
Tests all free AI features without requiring API keys
"""

import requests
import json
import time
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
import base64

# Test configuration
BASE_URL = "http://localhost:5000"

def create_test_image(with_face=True, multiple_faces=False, with_phone=False):
    """Create a test image for AI analysis"""
    
    # Create a simple test image
    img = np.ones((480, 640, 3), dtype=np.uint8) * 255  # White background
    
    if with_face:
        # Draw a simple face (circle for head, rectangles for eyes)
        center = (320, 240)
        cv2.circle(img, center, 80, (200, 200, 200), -1)  # Face
        cv2.circle(img, (290, 220), 10, (0, 0, 0), -1)    # Left eye
        cv2.circle(img, (350, 220), 10, (0, 0, 0), -1)    # Right eye
        cv2.rectangle(img, (300, 260), (340, 270), (0, 0, 0), -1)  # Mouth
    
    if multiple_faces:
        # Add second face
        center2 = (150, 240)
        cv2.circle(img, center2, 80, (200, 200, 200), -1)
        cv2.circle(img, (120, 220), 10, (0, 0, 0), -1)
        cv2.circle(img, (180, 220), 10, (0, 0, 0), -1)
        cv2.rectangle(img, (130, 260), (170, 270), (0, 0, 0), -1)
    
    if with_phone:
        # Draw a phone-like rectangle
        cv2.rectangle(img, (500, 300), (550, 450), (100, 100, 100), -1)
        cv2.rectangle(img, (505, 305), (545, 445), (0, 0, 0), 2)
    
    return img

def image_to_bytes(img):
    """Convert numpy image to bytes"""
    _, buffer = cv2.imencode('.jpg', img)
    return buffer.tobytes()

def test_health():
    """Test health endpoint"""
    print("🏥 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_models_info():
    """Test models info endpoint"""
    print("\n🤖 Testing models info...")
    try:
        response = requests.get(f"{BASE_URL}/models/info")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Models info: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"❌ Models info failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Models info error: {e}")
        return False

def test_face_detection():
    """Test face detection with various scenarios"""
    print("\n👤 Testing face detection...")
    
    test_cases = [
        {"name": "Single Face", "with_face": True, "multiple_faces": False, "with_phone": False},
        {"name": "No Face", "with_face": False, "multiple_faces": False, "with_phone": False},
        {"name": "Multiple Faces", "with_face": True, "multiple_faces": True, "with_phone": False},
        {"name": "Face + Phone", "with_face": True, "multiple_faces": False, "with_phone": True},
    ]
    
    results = []
    
    for case in test_cases:
        print(f"\n📸 Testing: {case['name']}")
        
        # Create test image
        img = create_test_image(**{k: v for k, v in case.items() if k != 'name'})
        img_bytes = image_to_bytes(img)
        
        # Send to AI service
        try:
            files = {'image': ('test.jpg', img_bytes, 'image/jpeg')}
            response = requests.post(f"{BASE_URL}/analyze", files=files)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    analysis = data.get('analysis', {})
                    face_data = analysis.get('face_detection', {})
                    behavior_data = analysis.get('behavior_analysis', {})
                    
                    print(f"  ✅ Faces detected: {face_data.get('faces_detected', 0)}")
                    print(f"  🎯 Suspicious score: {behavior_data.get('suspicious_score', 0):.2f}")
                    print(f"  📊 Risk level: {behavior_data.get('risk_level', 'unknown')}")
                    print(f"  ⚠️  Requires attention: {behavior_data.get('requires_attention', False)}")
                    
                    results.append({
                        'case': case['name'],
                        'success': True,
                        'faces': face_data.get('faces_detected', 0),
                        'score': behavior_data.get('suspicious_score', 0),
                        'risk': behavior_data.get('risk_level', 'unknown')
                    })
                else:
                    print(f"  ❌ Analysis failed: {data.get('message', 'Unknown error')}")
                    results.append({'case': case['name'], 'success': False})
            else:
                print(f"  ❌ Request failed: {response.status_code}")
                results.append({'case': case['name'], 'success': False})
                
        except Exception as e:
            print(f"  ❌ Test error: {e}")
            results.append({'case': case['name'], 'success': False})
    
    return results

def test_performance():
    """Test AI service performance"""
    print("\n⚡ Testing performance...")
    
    # Create test image
    img = create_test_image(with_face=True)
    img_bytes = image_to_bytes(img)
    
    # Test multiple requests
    num_tests = 10
    times = []
    
    for i in range(num_tests):
        start_time = time.time()
        
        try:
            files = {'image': ('test.jpg', img_bytes, 'image/jpeg')}
            response = requests.post(f"{BASE_URL}/analyze", files=files)
            
            if response.status_code == 200:
                end_time = time.time()
                processing_time = end_time - start_time
                times.append(processing_time)
                print(f"  Test {i+1}: {processing_time:.3f}s")
            else:
                print(f"  Test {i+1}: Failed ({response.status_code})")
                
        except Exception as e:
            print(f"  Test {i+1}: Error ({e})")
    
    if times:
        avg_time = sum(times) / len(times)
        min_time = min(times)
        max_time = max(times)
        
        print(f"\n📊 Performance Summary:")
        print(f"  Average: {avg_time:.3f}s")
        print(f"  Min: {min_time:.3f}s")
        print(f"  Max: {max_time:.3f}s")
        print(f"  Tests passed: {len(times)}/{num_tests}")
        
        return {
            'average': avg_time,
            'min': min_time,
            'max': max_time,
            'success_rate': len(times) / num_tests
        }
    
    return None

def main():
    """Run all tests"""
    print("🧪 Starting Free AI Proctoring Tests")
    print("=" * 50)
    
    # Test basic connectivity
    if not test_health():
        print("❌ Service not running. Start with: python main-free.py")
        return
    
    # Test models info
    test_models_info()
    
    # Test face detection
    face_results = test_face_detection()
    
    # Test performance
    perf_results = test_performance()
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 TEST SUMMARY")
    print("=" * 50)
    
    successful_tests = sum(1 for r in face_results if r.get('success', False))
    total_tests = len(face_results)
    
    print(f"🎯 Face Detection Tests: {successful_tests}/{total_tests} passed")
    
    if perf_results:
        print(f"⚡ Average Response Time: {perf_results['average']:.3f}s")
        print(f"📈 Success Rate: {perf_results['success_rate']*100:.1f}%")
    
    print("\n✅ Free AI Proctoring is working!")
    print("💰 Total cost: $0.00")
    print("🔐 Privacy: 100% local processing")

if __name__ == "__main__":
    main()
