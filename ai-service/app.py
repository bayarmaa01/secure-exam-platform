from flask import Flask, request, jsonify
import face_recognition
import numpy as np
import requests
import os
import base64
import cv2

app = Flask(__name__)

BACKEND_URL = "http://localhost:5000/api/ai/alert"
SECRET = os.getenv("AI_SERVICE_SECRET", "ai-secret-key")

@app.route("/analyze", methods=["POST"])
def analyze():
    image_b64 = request.json["frame"]
    user_id = request.json["user_id"]

    img_bytes = base64.b64decode(image_b64.split(",")[1])
    np_img = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    faces = face_recognition.face_locations(frame)

    flags = []
    score = 0.0

    if len(faces) == 0:
        flags.append("no_face_detected")
        score += 0.4
    elif len(faces) > 1:
        flags.append("multiple_faces")
        score += 0.8

    if score > 0:
        requests.post(
            BACKEND_URL,
            json={
                "user_id": user_id,
                "cheating_score": score,
                "flags": flags,
            },
            headers={"x-ai-secret": SECRET},
        )

    return jsonify({"faces": len(faces), "flags": flags})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7000)
