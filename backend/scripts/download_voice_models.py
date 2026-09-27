#!/usr/bin/env python3
"""Download Piper TTS voice models for SMARTER-AI.

Run this script to fetch the required Telugu and English voice models.
"""
from __future__ import annotations

import sys
from pathlib import Path

from huggingface_hub import hf_hub_download


def download_model(repo_id: str, filename: str, dest_dir: Path) -> Path:
    print(f"Downloading {repo_id}/{filename} ...")
    path = hf_hub_download(
        repo_id=repo_id,
        filename=filename,
        local_dir=str(dest_dir),
        local_dir_use_symlinks=False,
    )
    print(f"  -> {path}")
    return Path(path)


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    models_dir = root / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    files = [
        ("rhasspy/piper-voices", "te/te_IN/padmavathi/medium/te_IN-padmavathi-medium.onnx"),
        ("rhasspy/piper-voices", "te/te_IN/padmavathi/medium/te_IN-padmavathi-medium.onnx.json"),
        ("rhasspy/piper-voices", "en/en_US/ryan/medium/en_US-ryan-medium.onnx"),
        ("rhasspy/piper-voices", "en/en_US/ryan/medium/en_US-ryan-medium.onnx.json"),
    ]

    for repo, filename in files:
        try:
            download_model(repo, filename, models_dir)
        except Exception as exc:
            print(f"  ERROR downloading {filename}: {exc}", file=sys.stderr)
            return 1

    print("\nAll Piper voice models downloaded successfully.")
    print(f"Models directory: {models_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
