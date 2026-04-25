from fastapi import FastAPI, File, UploadFile, APIRouter, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
import io
import json
import time
import uuid
from typing import Dict, List, Optional
from datetime import datetime
import redis
import os
from prometheus_client import Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST
import mediapipe as mp

app = FastAPI(title="AI Proctoring Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
)

# Initialize MediaPipe Face Detection
face_detection = None
try:
    # Try different MediaPipe API versions
    if hasattr(mp, 'solutions') and hasattr(mp.solutions, 'face_detection'):
        mp_face_detection = mp.solutions.face_detection
        face_detection = mp_face_detection.FaceDetection(
            model_selection=0, min_detection_confidence=0.5
        )
    elif hasattr(mp, 'face_detection'):
        face_detection = mp.face_detection.FaceDetection(
            model_selection=0, min_detection_confidence=0.5
        )
    else:
        raise AttributeError("MediaPipe face detection not found in this version")
    
    print("MediaPipe face detection initialized successfully")
except AttributeError as e:
    print(f"MediaPipe face detection not available: {e}")
    print("Using fallback mode without face detection")
    face_detection = None
except Exception as e:
    print(f"Error initializing MediaPipe: {e}")
    print("Using fallback mode without face detection")
    face_detection = None

# Redis connection for session management
try:
    redis_host = os.getenv('REDIS_HOST', 'redis')  # Use 'redis' for Docker environment
    redis_port = int(os.getenv('REDIS_PORT', 6379))
    print(f"Attempting to connect to Redis at {redis_host}:{redis_port}")
    
    redis_client = redis.Redis(
        host=redis_host,
        port=redis_port,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5
    )
    
    # Test connection
    redis_client.ping()
    print(f"Successfully connected to Redis at {redis_host}:{redis_port}")
    
except Exception as e:
    redis_client = None
    print(f"Warning: Redis not available, using in-memory storage. Error: {e}")

# In-memory fallback for sessions
sessions = {}

AI_ANALYZE_TOTAL = Counter("ai_analyze_requests_total", "Total AI frame analysis requests")
AI_TAB_SWITCH_TOTAL = Counter("ai_tab_switch_events_total", "Total tab-switch events")
AI_RISK_SCORE = Gauge("ai_current_risk_score", "Current proctoring risk score", ["session_id"])

class ProctoringSession(BaseModel):
    session_id: str
    attempt_id: str
    student_id: str
    start_time: datetime
    risk_score: int = 0
    events: List[Dict] = []
    face_detection_count: int = 0
    no_face_count: int = 0
    multiple_faces_count: int = 0
    tab_switch_count: int = 0
    last_frame_time: Optional[float] = None

class EventData(BaseModel):
    event_type: str
    timestamp: float
    data: Dict

class TabSwitchEvent(BaseModel):
    attempt_id: str
    timestamp: float
    url: Optional[str] = None
    reason: str

def analyze_frame(image_bytes: bytes, session: ProctoringSession) -> dict:
    """Analyze webcam frame for suspicious behavior with enhanced MediaPipe detection."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {
            "face_detected": False, 
            "cheating_probability": 0.0,
            "risk_score": 10,
            "event_type": "no_frame"
        }

    current_time = time.time()
    
    # Check frame rate for suspicious activity
    if session.last_frame_time:
        time_diff = current_time - session.last_frame_time
        if time_diff > 5.0:  # Gap of more than 5 seconds
            session.risk_score += 5
            session.events.append({
                "type": "frame_gap",
                "timestamp": current_time,
                "data": {"gap_duration": time_diff}
            })
    
    session.last_frame_time = current_time

    # Convert BGR to RGB for MediaPipe
    rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Extract face information from MediaPipe results
    faces = []
    if face_detection is not None:
        try:
            results = face_detection.process(rgb_img)
            if results and results.detections:
                for detection in results.detections:
                    bbox = detection.location_data.relative_bounding_box
                    h, w, _ = img.shape
                    faces.append((
                        int(bbox.xmin * w),
                        int(bbox.ymin * h),
                        int(bbox.width * w),
                        int(bbox.height * h)
                    ))
        except Exception as e:
            print(f"Error processing face detection: {e}")
            # Continue without face detection
    else:
        print("Face detection not available - using fallback mode")

    event_data = {
        "timestamp": current_time,
        "face_count": len(faces),
        "frame_size": img.shape[:2]
    }

    if len(faces) == 0:
        session.no_face_count += 1
        session.risk_score += 3
        cheating_probability = min(0.7, 0.3 + (session.no_face_count * 0.1))
        event_type = "no_face_detected"
    elif len(faces) > 1:
        session.multiple_faces_count += 1
        session.risk_score += 15
        cheating_probability = min(0.9, 0.6 + (session.multiple_faces_count * 0.1))
        event_type = "multiple_faces_detected"
        event_data["face_positions"] = [(int(x), int(y), int(w), int(h)) for x, y, w, h in faces]
    else:
        session.face_detection_count += 1
        x, y, w, h = faces[0]
        face_area = w * h
        frame_area = img.shape[0] * img.shape[1]
        face_ratio = face_area / frame_area

        # Analyze face position and size
        if face_ratio < 0.05:  # Face too small/far
            session.risk_score += 5
            cheating_probability = 0.4
            event_type = "face_too_small"
        elif face_ratio > 0.3:  # Face too large/close
            session.risk_score += 3
            cheating_probability = 0.2
            event_type = "face_too_large"
        else:
            cheating_probability = 0.1
            event_type = "face_detected_normally"
        
        event_data["face_position"] = {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}
        event_data["face_ratio"] = face_ratio

    # Cap risk score at 100
    session.risk_score = min(100, session.risk_score)
    
    session.events.append({
        "type": event_type,
        "timestamp": current_time,
        "data": event_data
    })

    return {
        "face_detected": len(faces) > 0,
        "face_count": len(faces),
        "cheating_probability": cheating_probability,
        "risk_score": session.risk_score,
        "event_type": event_type,
        "session_stats": {
            "face_detection_count": session.face_detection_count,
            "no_face_count": session.no_face_count,
            "multiple_faces_count": session.multiple_faces_count,
            "tab_switch_count": session.tab_switch_count
        }
    }

def get_session(session_id: str) -> Optional[ProctoringSession]:
    """Retrieve proctoring session from storage."""
    if redis_client:
        try:
            data = redis_client.get(f"proctoring_session:{session_id}")
            if data:
                session_dict = json.loads(data)
                return ProctoringSession(**session_dict)
        except Exception as e:
            print(f"Redis error: {e}")
    
    return sessions.get(session_id)

def save_session(session: ProctoringSession):
    """Save proctoring session to storage."""
    if redis_client:
        try:
            redis_client.setex(
                f"proctoring_session:{session.session_id}",
                3600,  # 1 hour expiry
                json.dumps(session.dict(), default=str)
            )
        except Exception as e:
            print(f"Redis error: {e}")
    
    sessions[session.session_id] = session

class SessionStartRequest(BaseModel):
    attempt_id: str
    student_id: str

@app.post("/ai/session/start")
async def start_session(request: SessionStartRequest):
    """Start a new proctoring session."""
    print(f"[AI PROCTORING] ===== SESSION START REQUEST =====")
    print(f"[AI PROCTORING] Request body: {request}")
    print(f"[AI PROCTORING] Attempt ID: {request.attempt_id}")
    print(f"[AI PROCTORING] Student ID: {request.student_id}")
    
    # Validate required fields
    if not request.attempt_id or not request.student_id:
        print(f"[AI PROCTORING] ERROR: Missing required fields")
        raise HTTPException(status_code=400, detail="attempt_id and student_id are required")
    
    session_id = str(uuid.uuid4())
    session = ProctoringSession(
        session_id=session_id,
        attempt_id=request.attempt_id,
        student_id=request.student_id,
        start_time=datetime.now()
    )
    
    print(f"[AI PROCTORING] Creating session {session_id} for attempt {request.attempt_id}")
    save_session(session)
    
    response = {
        "session_id": session_id,
        "status": "started",
        "start_time": session.start_time.isoformat()
    }
    
    print(f"[AI PROCTORING] Session started successfully: {response}")
    return response

@app.post("/ai/analyze")
async def analyze_frame_endpoint(
    session_id: str = None,
    image: UploadFile = File(...)
):
    """Analyze webcam frame for suspicious behavior."""
    print(f"[AI PROCTORING] Frame analysis request for session: {session_id}")
    
    if not session_id:
        print("[AI PROCTORING] ERROR: Session ID required")
        raise HTTPException(status_code=400, detail="Session ID required")
    
    session = get_session(session_id)
    if not session:
        print(f"[AI PROCTORING] ERROR: Session {session_id} not found")
        raise HTTPException(status_code=404, detail="Session not found")
    
    print(f"[AI PROCTORING] Analyzing frame for session {session_id}, current risk score: {session.risk_score}")
    
    contents = await image.read()
    AI_ANALYZE_TOTAL.inc()
    result = analyze_frame(contents, session)
    
    print(f"[AI PROCTORING] Analysis result: {result['event_type']}, risk_score: {result['risk_score']}")
    
    # Save updated session
    save_session(session)
    AI_RISK_SCORE.labels(session.session_id).set(session.risk_score)
    
    return result

@app.post("/ai/tab-switch")
async def handle_tab_switch(event: TabSwitchEvent):
    """Handle tab switching event."""
    # Find session by attempt_id
    session = None
    for s in sessions.values():
        if s.attempt_id == event.attempt_id:
            session = s
            break
    
    if not session:
        # Try Redis
        if redis_client:
            try:
                keys = redis_client.keys("proctoring_session:*")
                for key in keys:
                    data = redis_client.get(key)
                    if data:
                        session_dict = json.loads(data)
                        if session_dict.get("attempt_id") == event.attempt_id:
                            session = ProctoringSession(**session_dict)
                            break
            except:
                pass
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update session with tab switch event
    session.tab_switch_count += 1
    session.risk_score += 10  # Tab switching is suspicious
    AI_TAB_SWITCH_TOTAL.inc()
    
    session.events.append({
        "type": "tab_switch",
        "timestamp": event.timestamp,
        "data": {
            "url": event.url,
            "reason": event.reason
        }
    })
    
    save_session(session)
    AI_RISK_SCORE.labels(session.session_id).set(session.risk_score)
    
    return {
        "status": "recorded",
        "tab_switch_count": session.tab_switch_count,
        "risk_score": session.risk_score
    }

@app.get("/ai/session/{session_id}/status")
async def get_session_status(session_id: str):
    """Get current session status and risk score."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session.session_id,
        "attempt_id": session.attempt_id,
        "student_id": session.student_id,
        "risk_score": session.risk_score,
        "start_time": session.start_time.isoformat(),
        "events_count": len(session.events),
        "stats": {
            "face_detection_count": session.face_detection_count,
            "no_face_count": session.no_face_count,
            "multiple_faces_count": session.multiple_faces_count,
            "tab_switch_count": session.tab_switch_count
        }
    }

@app.get("/ai/session/{session_id}/events")
async def get_session_events(session_id: str, limit: int = 50):
    """Get recent events for a session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Return most recent events
    recent_events = sorted(session.events, key=lambda x: x["timestamp"], reverse=True)[:limit]
    
    return {
        "events": recent_events,
        "total_events": len(session.events)
    }

@app.post("/ai/session/{session_id}/end")
async def end_session(session_id: str):
    """End proctoring session and return final report."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Generate final report
    final_report = {
        "session_id": session.session_id,
        "attempt_id": session.attempt_id,
        "student_id": session.student_id,
        "start_time": session.start_time.isoformat(),
        "end_time": datetime.now().isoformat(),
        "final_risk_score": session.risk_score,
        "risk_level": "low" if session.risk_score < 30 else "medium" if session.risk_score < 70 else "high",
        "summary": {
            "total_events": len(session.events),
            "face_detection_count": session.face_detection_count,
            "no_face_count": session.no_face_count,
            "multiple_faces_count": session.multiple_faces_count,
            "tab_switch_count": session.tab_switch_count
        },
        "events": session.events
    }
    
    # Clean up session
    if redis_client:
        try:
            redis_client.delete(f"proctoring_session:{session_id}")
        except:
            pass
    
    if session_id in sessions:
        del sessions[session_id]
    
    return final_report

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
