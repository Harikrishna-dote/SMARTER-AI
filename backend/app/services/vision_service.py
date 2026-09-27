from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile
import shutil

import httpx
import pytesseract
from fastapi import HTTPException, status
from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError
from pytesseract import TesseractNotFoundError

from typing import Any

from app.services.ai_gateway import AIGateway


class VisionService:
    def __init__(self, gateway: AIGateway | None = None):
        self.gateway = gateway or AIGateway()
        self._configure_tesseract()

    @staticmethod
    def _configure_tesseract() -> None:
        if shutil.which("tesseract"):
            return
        windows_binary = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
        if windows_binary.exists():
            pytesseract.pytesseract.tesseract_cmd = str(windows_binary)

    async def ocr(self, file: UploadFile) -> str:
        return self.ocr_bytes(await file.read())

    def ocr_bytes(self, content: bytes) -> str:
        try:
            image = Image.open(BytesIO(content))
        except UnidentifiedImageError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload a valid image file",
            ) from exc

        try:
            return pytesseract.image_to_string(image)
        except TesseractNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Tesseract OCR is not installed or is not available on PATH",
            ) from exc

    async def analyze(self, file: UploadFile) -> str:
        content = await file.read()
        text = self.ocr_bytes(content)
        prompt = "Summarize the image from OCR text. If OCR is sparse, say so."
        return await self.gateway.chat(
            [
                {"role": "system", "content": "You analyze images using local OCR and local language models."},
                {"role": "user", "content": f"{prompt}\n\nOCR text:\n{text}"},
            ]
        )

    async def media_context(self, file: UploadFile) -> dict:
        content = await file.read()
        content_type = file.content_type or "application/octet-stream"
        filename = file.filename or "upload"

        if content_type.startswith("image/"):
            text = self.ocr_bytes(content)
            summary = await self._safe_summary(
                [
                    {
                        "role": "system",
                        "content": "Turn OCR from an image into concise study context for an AI tutor.",
                    },
                    {
                        "role": "user",
                        "content": (
                            "Describe what the student likely uploaded, preserve equations or labels, "
                            f"and point out missing visual details.\n\nOCR text:\n{text or '[no OCR text]'}"
                        ),
                    },
                ]
            )
            return {
                "type": "image",
                "name": filename,
                "content_type": content_type,
                "text": text,
                "summary": summary,
                "processing_notes": ["Image OCR completed with Tesseract."],
            }

        if content_type.startswith("video/"):
            text, notes = self._extract_video_frame_text(content, filename)
            summary = await self._safe_summary(
                [
                    {
                        "role": "system",
                        "content": "Turn video frame OCR and metadata into concise study context for an AI tutor.",
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Video file: {filename}\nContent type: {content_type}\nSize: {len(content)} bytes\n"
                            f"Frame OCR:\n{text or '[no frame text extracted]'}"
                        ),
                    },
                ]
            )
            return {
                "type": "video",
                "name": filename,
                "content_type": content_type,
                "text": text,
                "summary": summary,
                "processing_notes": notes,
            }

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload an image or video file",
        )

    async def _safe_summary(self, messages: list[dict[str, str]]) -> str:
        try:
            return await self.gateway.chat(messages)
        except (httpx.HTTPError, TimeoutError):
            return "Local vision summary is unavailable because the language model is offline. OCR text was still captured when possible."

    def _extract_video_frame_text(self, content: bytes, filename: str) -> tuple[str, list[str]]:
        notes: list[str] = []
        try:
            import cv2  # type: ignore[import-not-found]
        except ImportError:
            return (
                "",
                [
                    "Video accepted as context.",
                    "Install opencv-python-headless to enable frame OCR from videos.",
                ],
            )

        suffix = Path(filename).suffix or ".mp4"
        with NamedTemporaryFile(suffix=suffix, delete=True) as temp_file:
            temp_file.write(content)
            temp_file.flush()
            capture = cv2.VideoCapture(temp_file.name)
            if not capture.isOpened():
                return "", ["Video could not be opened for frame analysis."]

            frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            if frame_count <= 0:
                frame_positions = [0]
            else:
                step = max(frame_count // 5, 1)
                frame_positions = list(range(0, frame_count, step))[:5]

            extracted: list[str] = []
            for position in frame_positions:
                capture.set(cv2.CAP_PROP_POS_FRAMES, position)
                ok, frame = capture.read()
                if not ok:
                    continue
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = Image.fromarray(rgb_frame)
                try:
                    frame_text = pytesseract.image_to_string(image).strip()
                except TesseractNotFoundError:
                    capture.release()
                    return "", ["Tesseract OCR is not installed or is not available on PATH."]
                if frame_text:
                    extracted.append(f"Frame {position}: {frame_text}")

            capture.release()
            notes.append(f"Sampled {len(frame_positions)} video frame(s) for OCR.")
            if not extracted:
                notes.append("No readable text was found in sampled frames.")
            return "\n\n".join(extracted), notes
