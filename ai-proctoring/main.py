from fastapi import FastAPI, File, UploadFile, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import io

app = FastAPI(title="AI Proctoring Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
)


def analyze_frame(image_bytes: bytes) -> dict:
    """Analyze webcam frame for suspicious behavior."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"face_detected": False, "cheating_probability": 0.0}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)

    if len(faces) == 0:
        return {"face_detected": False, "cheating_probability": 0.4}
    if len(faces) > 1:
        return {"face_detected": True, "multiple_faces": True, "cheating_probability": 0.6}

    x, y, w, h = faces[0]
    face_area = w * h
    frame_area = img.shape[0] * img.shape[1]
    face_ratio = face_area / frame_area

    if face_ratio < 0.05:
        return {"face_detected": True, "cheating_probability": 0.5}
    return {"face_detected": True, "cheating_probability": 0.1}


async def analyze(image: UploadFile = File(...)):
    contents = await image.read()
    result = analyze_frame(contents)
    return result


router = APIRouter()
router.add_api_route("/analyze", analyze, methods=["POST"])
app.include_router(router, prefix="/ai")
app.add_api_route("/analyze", analyze, methods=["POST"])


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
