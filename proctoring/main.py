"""
AI-assisted proctoring signal service.

Analyzes permitted camera frames for face presence, multiple faces and motion,
and computes audio activity from RMS energy reports sent by the student browser.

IMPORTANT: Outputs are SIGNALS requiring instructor review, never accusations.
This service performs no identity verification and stores no media.
"""
from __future__ import annotations

import threading
import time
import uuid
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

FRAME_TTL_SECONDS = 3.0
MAX_STATES = 500

# session_id -> {"frame": np.ndarray (gray, uint8), "at": float}
_motion_states: dict[str, dict] = {}
_motion_lock = threading.Lock()


def _cleanup_motion_states() -> None:
    now = time.time()
    stale = [k for k, v in _motion_states.items() if now - v["at"] > FRAME_TTL_SECONDS]
    for k in stale:
        _motion_states.pop(k, None)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    app.state.face_cascade = cv2.CascadeClassifier(cascade_path)
    if app.state.face_cascade.empty():
        app.state.face_cascade = None
    yield


app = FastAPI(title="Proctoring Signal Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


class AudioReport(BaseModel):
    sessionId: str = Field(..., min_length=1)
    rms: float = Field(..., ge=0, le=1)
    zeroCrossings: float = Field(0, ge=0)
    samples: int = Field(1024, ge=1)


class AnalyzeResponse(BaseModel):
    signalId: str
    sessionId: str | None = None
    faces: int
    faceDetected: bool
    multipleFaces: bool
    motionScore: float
    motionDetected: bool
    confidence: float
    model: str
    timestamp: str


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "proctoring-signal-service",
        "faceModel": app.state.face_cascade is not None,
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(file: UploadFile = File(...), session_id: str | None = None) -> AnalyzeResponse:
    data = await file.read()
    if not data:
        return _result(session_id, 0, 0.0, False, 0.0)

    # Decode JPEG/PNG payload.
    buf = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        return _result(session_id, 0, 0.0, False, 0.0)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (320, 240))

    faces = 0
    confidence = 0.0
    cascade = getattr(app.state, "face_cascade", None)
    if cascade is not None:
        detections = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
        faces = len(detections)
        confidence = 0.98 if faces > 0 else 0.9

    motion_score = _motion_score(session_id, gray)
    motion_detected = motion_score > 0.35

    return _result(session_id, faces, motion_score, motion_detected, confidence)


@app.post("/audio")
def audio(report: AudioReport) -> dict:
    """Classify an audio-activity signal from browser-reported RMS energy."""
    rms = max(0.0, min(1.0, report.rms))
    zc = max(0.0, report.zeroCrossings)
    # Sustained loud input (>0.25 RMS) or speech-like zero-crossing rate is a signal.
    activity = rms > 0.25 or (0.05 < rms <= 0.25 and zc > 0.4)
    return {
        "signalId": str(uuid.uuid4()),
        "sessionId": report.sessionId,
        "audioActivity": bool(activity),
        "rms": round(rms, 4),
        "zeroCrossings": round(zc, 4),
        "level": "high" if rms > 0.25 else ("medium" if rms > 0.05 else "low"),
        "recommendation": "Audio signal detected; instructor review recommended." if activity else "No audio signal.",
    }


def _motion_score(session_id: str | None, gray: np.ndarray) -> float:
    if not session_id:
        return 0.0
    with _motion_lock:
        _cleanup_motion_states()
        if len(_motion_states) >= MAX_STATES:
            return 0.0
        prev = _motion_states.get(session_id)
        score = 0.0
        if prev is not None and time.time() - prev["at"] <= FRAME_TTL_SECONDS:
            diff = cv2.absdiff(prev["frame"], gray)
            score = float(np.mean(diff) / 255.0)
        _motion_states[session_id] = {"frame": gray.copy(), "at": time.time()}
        return score


def _result(
    session_id: str | None,
    faces: int,
    motion_score: float,
    motion_detected: bool,
    confidence: float,
) -> AnalyzeResponse:
    return AnalyzeResponse(
        signalId=str(uuid.uuid4()),
        sessionId=session_id,
        faces=faces,
        faceDetected=faces > 0,
        multipleFaces=faces > 1,
        motionScore=round(motion_score, 4),
        motionDetected=motion_detected,
        confidence=round(confidence, 2),
        model="opencv-haar",
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
