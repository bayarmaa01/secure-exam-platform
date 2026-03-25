from fastapi import FastAPI, File, UploadFile, APIRouter, Response
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import io
import os
import logging
from typing import Dict, Any
import time
from prometheus_client import Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST, REGISTRY

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus Metrics
CHEATING_SCORE_GAUGE = Gauge('ai_proctoring_cheating_score', 'Current cheating detection score', ['exam_id'])
MULTIPLE_FACES_DETECTED = Counter('ai_proctoring_multiple_faces_detected_total', 'Total multiple face detections', ['exam_id'])
TAB_SWITCH_COUNT = Counter('ai_proctoring_tab_switch_total', 'Total tab switches detected', ['exam_id'])

app = FastAPI(title="AI Proctoring Service - Free AI Models")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
)

class FreeAIProctor:
    """Free AI-based proctoring using OpenCV and local models"""
    
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        self.eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_eye.xml"
        )
        self.smile_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_smile.xml"
        )
        
        # Load pre-trained models for behavior analysis
        self.load_models()
        
    def load_models(self):
        """Load free pre-trained models"""
        try:
            # Try to load DNN face detector (more accurate than Haar)
            face_net = cv2.dnn.readNetFromTensorflow(
                "models/opencv_face_detector_uint8.pb",
                "models/opencv_face_detector.pbtxt"
            )
            self.face_net = face_net
            logger.info("DNN Face detector loaded")
        except:
            self.face_net = None
            logger.warning("DNN Face detector not found, using Haar cascade")
    
    def analyze_face_detection(self, img: np.ndarray) -> Dict[str, Any]:
        """Advanced face detection using multiple methods"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Method 1: Haar Cascade (always available)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
        
        # Method 2: DNN (if available)
        dnn_faces = []
        if self.face_net:
            try:
                h, w = img.shape[:2]
                blob = cv2.dnn.blobFromImage(img, 1.0, (300, 300), [104, 117, 123])
                self.face_net.setInput(blob)
                detections = self.face_net.forward()
                
                for i in range(detections.shape[2]):
                    confidence = detections[0, 0, i, 2]
                    if confidence > 0.7:
                        x1 = int(detections[0, 0, i, 3] * w)
                        y1 = int(detections[0, 0, i, 4] * h)
                        x2 = int(detections[0, 0, i, 5] * w)
                        y2 = int(detections[0, 0, i, 6] * h)
                        dnn_faces.append([x1, y1, x2-x1, y2-y1])
            except Exception as e:
                logger.warning(f"DNN detection failed: {e}")
        
        # Use best detection method
        all_faces = dnn_faces if len(dnn_faces) > 0 else faces.tolist()
        
        return {
            "faces_detected": len(all_faces),
            "face_locations": all_faces,
            "detection_method": "DNN" if len(dnn_faces) > 0 else "Haar"
        }
    
    def analyze_eye_tracking(self, img: np.ndarray, face_rect: tuple) -> Dict[str, Any]:
        """Analyze eye movement and gaze direction"""
        x, y, w, h = face_rect
        face_roi = img[y:y+h, x:x+w]
        gray_roi = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        
        eyes = self.eye_cascade.detectMultiScale(gray_roi)
        
        return {
            "eyes_detected": len(eyes),
            "looking_away": len(eyes) < 2,
            "eye_positions": eyes.tolist() if len(eyes) > 0 else []
        }
    
    def analyze_head_pose(self, img: np.ndarray, face_rect: tuple) -> Dict[str, Any]:
        """Simple head pose estimation"""
        x, y, w, h = face_rect
        
        # Simple heuristics for head pose
        face_center_x = x + w // 2
        frame_center_x = img.shape[1] // 2
        deviation = abs(face_center_x - frame_center_x) / frame_center_x
        
        head_turned = deviation > 0.3
        
        return {
            "head_center_x": face_center_x,
            "frame_center_x": frame_center_x,
            "deviation": deviation,
            "head_turned": head_turned,
            "head_direction": "left" if face_center_x < frame_center_x else "right"
        }
    
    def detect_suspicious_objects(self, img: np.ndarray) -> Dict[str, Any]:
        """Detect potential suspicious objects using contour analysis"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter for phone-like objects (rectangular with specific aspect ratio)
        suspicious_objects = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 1000:  # Filter small objects
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = w / h
                
                # Phone-like objects (aspect ratio between 0.4 and 0.8)
                if 0.4 < aspect_ratio < 0.8 and area > 2000:
                    suspicious_objects.append({
                        "type": "potential_phone",
                        "location": [x, y, w, h],
                        "area": area,
                        "aspect_ratio": aspect_ratio
                    })
        
        return {
            "suspicious_objects_count": len(suspicious_objects),
            "suspicious_objects": suspicious_objects
        }
    
    def analyze_behavior_pattern(self, face_data: Dict, eye_data: Dict, head_data: Dict, objects_data: Dict) -> Dict[str, Any]:
        """Analyze overall behavior pattern"""
        suspicious_score = 0.0
        reasons = []
        
        # Face detection issues
        if face_data["faces_detected"] == 0:
            suspicious_score += 0.4
            reasons.append("No face detected")
        elif face_data["faces_detected"] > 1:
            suspicious_score += 0.6
            reasons.append("Multiple faces detected")
        
        # Eye tracking issues
        if eye_data.get("looking_away", False):
            suspicious_score += 0.3
            reasons.append("Looking away from screen")
        
        # Head pose issues
        if head_data.get("head_turned", False):
            suspicious_score += 0.2
            reasons.append(f"Head turned {head_data.get('head_direction', 'unknown')}")
        
        # Suspicious objects
        if objects_data["suspicious_objects_count"] > 0:
            suspicious_score += 0.5
            reasons.append("Suspicious objects detected")
        
        # Cap the score
        suspicious_score = min(suspicious_score, 1.0)
        
        return {
            "suspicious_score": suspicious_score,
            "risk_level": "low" if suspicious_score < 0.3 else "medium" if suspicious_score < 0.7 else "high",
            "reasons": reasons,
            "requires_attention": suspicious_score > 0.5
        }

# Initialize AI proctor
ai_proctor = FreeAIProctor()

def analyze_frame(image_bytes: bytes) -> dict:
    """Comprehensive frame analysis using free AI models"""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {
                "status": "error",
                "message": "Invalid image data",
                "analysis": {}
            }
        
        # Perform comprehensive analysis
        face_analysis = ai_proctor.analyze_face_detection(img)
        
        eye_analysis = {}
        head_analysis = {}
        if face_analysis["faces_detected"] > 0:
            # Use first detected face for detailed analysis
            face_rect = face_analysis["face_locations"][0]
            eye_analysis = ai_proctor.analyze_eye_tracking(img, tuple(face_rect))
            head_analysis = ai_proctor.analyze_head_pose(img, tuple(face_rect))
        
        objects_analysis = ai_proctor.detect_suspicious_objects(img)
        behavior_analysis = ai_proctor.analyze_behavior_pattern(
            face_analysis, eye_analysis, head_analysis, objects_analysis
        )
        
        return {
            "status": "success",
            "timestamp": time.time(),
            "analysis": {
                "face_detection": face_analysis,
                "eye_tracking": eye_analysis,
                "head_pose": head_analysis,
                "object_detection": objects_analysis,
                "behavior_analysis": behavior_analysis
            }
        }
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return {
            "status": "error",
            "message": str(e),
            "analysis": {}
        }

async def analyze(image: UploadFile = File(...)):
    """Analyze uploaded image for proctoring"""
    contents = await image.read()
    result = analyze_frame(contents)
    return result

# API Routes
router = APIRouter()
router.add_api_route("/analyze", analyze, methods=["POST"])
app.include_router(router, prefix="/ai")
app.add_api_route("/analyze", analyze, methods=["POST"])

@app.get("/health")
async def health():
    return {"status": "ok", "ai_models": "free_open_source"}

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    if 'prometheus_client' in globals():
        return Response(generate_latest(), headers={"Content-Type": CONTENT_TYPE_LATEST})
    else:
        return {"status": "metrics not available"}

@app.get("/models/info")
async def models_info():
    """Get information about loaded AI models"""
    return {
        "face_detector": "DNN" if ai_proctor.face_net else "Haar Cascade",
        "eye_detector": "Haar Cascade",
        "object_detector": "Contour Analysis",
        "behavior_analysis": "Rule-based",
        "cost": "Free",
        "privacy": "Local processing only"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
