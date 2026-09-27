from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.services.document_service import DocumentService


def _service(tmp_path: Path, max_upload_size_mb: int = 1) -> DocumentService:
    service = object.__new__(DocumentService)
    service.settings = SimpleNamespace(
        upload_dir=str(tmp_path),
        max_upload_size_mb=max_upload_size_mb,
        allowed_upload_types=[
            "application/pdf",
            "text/plain",
        ],
    )
    return service


def test_document_upload_metadata_is_sanitized_and_type_checked(tmp_path):
    service = _service(tmp_path)

    assert service._sanitize_filename("..\\notes.pdf") == "notes.pdf"
    assert service._validate_upload("notes.pdf", "application/pdf") == "application/pdf"

    with pytest.raises(HTTPException) as exc_info:
        service._validate_upload("notes.pdf", "text/plain")

    assert exc_info.value.status_code == 415


@pytest.mark.asyncio
async def test_document_upload_stream_enforces_configured_size_limit(tmp_path):
    service = _service(tmp_path, max_upload_size_mb=1)
    upload = UploadFile(
        file=BytesIO(b"x" * (1024 * 1024 + 1)),
        filename="notes.txt",
        headers=Headers({"content-type": "text/plain"}),
    )
    destination = tmp_path / "notes.txt"

    with pytest.raises(HTTPException) as exc_info:
        await service._write_upload(destination, upload)

    assert exc_info.value.status_code == 413
