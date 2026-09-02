#!/usr/bin/env python3
"""Batch OCR tools/graduate images with the local Windows 11 OneOCR wrapper."""

from __future__ import annotations

import argparse
import ctypes
import json
import os
import re
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "tools" / "graduate"
DEFAULT_ENGINE = os.environ.get("WORDTAP_ONEOCR_DIR")
DEFAULT_OUTPUT = DEFAULT_INPUT / "ocr"
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}
OCR_OK = 0

ALLOC_FUNC = ctypes.CFUNCTYPE(ctypes.c_void_p, ctypes.c_size_t)
CRT = ctypes.cdll.msvcrt
CRT.malloc.argtypes = [ctypes.c_size_t]
CRT.malloc.restype = ctypes.c_void_p
CRT.free.argtypes = [ctypes.c_void_p]
CRT.free.restype = None


def _malloc(size: int) -> int:
    return CRT.malloc(size)


ALLOCATOR = ALLOC_FUNC(_malloc)


def natural_key(path: Path) -> list[int | str]:
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", path.name)]


def load_engine(engine_dir: Path):
    required = ["oneocr_wrapper.dll", "oneocr.dll", "oneocr.onemodel", "onnxruntime.dll"]
    missing = [name for name in required if not (engine_dir / name).is_file()]
    if missing:
        raise FileNotFoundError(f"OneOCR engine is missing: {', '.join(missing)}")

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.SetDllDirectoryW(str(engine_dir))
    dll = ctypes.CDLL(str(engine_dir / "oneocr_wrapper.dll"))
    dll.initModel.argtypes = [ctypes.c_wchar_p]
    dll.initModel.restype = ctypes.c_int
    dll.releaseModel.argtypes = []
    dll.releaseModel.restype = ctypes.c_int
    dll.ocrImage.argtypes = [ctypes.c_wchar_p, ctypes.POINTER(ctypes.c_char_p), ALLOC_FUNC]
    dll.ocrImage.restype = ctypes.c_int

    result = dll.initModel(str(engine_dir))
    if result != OCR_OK:
        raise RuntimeError(f"OneOCR initModel failed with code {result}")
    return dll


def recognize(dll, image_path: Path) -> dict:
    buffer = ctypes.c_char_p(None)
    result = dll.ocrImage(str(image_path), ctypes.byref(buffer), ALLOCATOR)
    try:
        if result != OCR_OK:
            raise RuntimeError(f"ocrImage failed with code {result}")
        if buffer.value is None:
            raise RuntimeError("ocrImage returned an empty buffer")
        return json.loads(buffer.value.decode("utf-8"))
    finally:
        if buffer.value is not None:
            CRT.free(ctypes.cast(buffer, ctypes.c_void_p))


def plain_text(payload: dict) -> str:
    lines = [str(line.get("text", "")).strip() for line in payload.get("lines", [])]
    return "\n".join(line for line in lines if line).strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument(
        "--engine",
        type=Path,
        default=Path(DEFAULT_ENGINE) if DEFAULT_ENGINE else None,
        help="OneOCR bin directory (or set WORDTAP_ONEOCR_DIR)",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    input_dir = args.input.resolve()
    if args.engine is None:
        parser.error("--engine is required unless WORDTAP_ONEOCR_DIR is set")
    engine_dir = args.engine.resolve()
    output_dir = args.output.resolve()
    images = sorted(
        (
            path
            for path in input_dir.rglob("*")
            if path.is_file()
            and path.suffix.casefold() in IMAGE_SUFFIXES
            and output_dir not in path.parents
        ),
        key=natural_key,
    )
    if not images:
        raise FileNotFoundError(f"No images found in {input_dir}")

    json_dir = output_dir / "json"
    text_dir = output_dir / "text"
    json_dir.mkdir(parents=True, exist_ok=True)
    text_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading OneOCR from {engine_dir} ...", flush=True)
    dll = load_engine(engine_dir)
    started = time.perf_counter()
    pages: list[dict] = []
    failures: list[dict] = []
    combined: list[str] = []
    try:
        for index, image_path in enumerate(images, start=1):
            relative = image_path.relative_to(input_dir)
            stem = image_path.stem
            try:
                payload = recognize(dll, image_path)
                text = plain_text(payload)
                (json_dir / f"{stem}.json").write_text(
                    json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
                (text_dir / f"{stem}.txt").write_text(text + "\n", encoding="utf-8")
                pages.append({
                    "image": relative.as_posix(),
                    "json": f"json/{stem}.json",
                    "text": f"text/{stem}.txt",
                    "lineCount": int(payload.get("line_count", len(payload.get("lines", [])))),
                    "characterCount": len(text),
                })
                combined.append(f"===== {relative.as_posix()} =====\n{text}")
                print(
                    f"[{index:03d}/{len(images):03d}] {relative.as_posix()} "
                    f"lines={pages[-1]['lineCount']} chars={len(text)}",
                    flush=True,
                )
            except Exception as error:  # continue so one bad page does not lose the batch
                failures.append({"image": relative.as_posix(), "error": str(error)})
                print(f"[{index:03d}/{len(images):03d}] FAILED {relative.as_posix()}: {error}", flush=True)
    finally:
        dll.releaseModel()

    elapsed = time.perf_counter() - started
    summary = {
        "schemaVersion": 1,
        "engine": "Windows 11 OneOCR",
        "input": input_dir.name,
        "imageCount": len(images),
        "successCount": len(pages),
        "failureCount": len(failures),
        "elapsedSeconds": round(elapsed, 3),
        "pages": pages,
        "failures": failures,
    }
    (output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "all.txt").write_text("\n\n".join(combined) + "\n", encoding="utf-8")
    print(
        f"Finished: {len(pages)}/{len(images)} succeeded, "
        f"{len(failures)} failed, {elapsed:.1f}s. Output: {output_dir}",
        flush=True,
    )
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
