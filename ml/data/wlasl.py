"""
ml/data/wlasl.py  — WLASL (Word-Level American Sign Language) loader.
dataset_id: wlasl  (must match ml/data/LICENSES.md entry)

WLASL provides ~21,000 video instances across 2,000 ASL word classes.
This loader:
  1. Reads the WLASL JSON metadata (wlasl_class_list.txt + WLASL_v0.3.json).
  2. Runs MediaPipe Hands offline to extract (T, 21, 3) landmark tensors.
  3. Caches tensors to ml/data/cache/wlasl/{split}.npz (gitignored).
  4. Returns (X, y, labels, signer_ids) matching the v2 loader contract.

Prerequisites:
    pip install mediapipe opencv-python-headless
    # Download WLASL videos and metadata to ml/data/raw/wlasl/
    # See https://github.com/dxli94/WLASL for download instructions.

Environment variables:
    WLASL_RAW_DIR   path to raw WLASL directory (default: ml/data/raw/wlasl)
    WLASL_CACHE_DIR path to cache directory     (default: ml/data/cache/wlasl)
    WLASL_MAX_CLASSES  max classes to load (default: 200 for v2 vocabulary)
    WLASL_T_FRAMES     target sequence length   (default: 45)
"""
from __future__ import annotations
import json, os, pathlib
import numpy as np

DATASET_ID = "wlasl"  # must match LICENSES.md

RAW_DIR   = pathlib.Path(os.environ.get("WLASL_RAW_DIR",   "ml/data/raw/wlasl"))
CACHE_DIR = pathlib.Path(os.environ.get("WLASL_CACHE_DIR", "ml/data/cache/wlasl"))
MAX_CLASSES = int(os.environ.get("WLASL_MAX_CLASSES", "200"))
T_FRAMES    = int(os.environ.get("WLASL_T_FRAMES",    "45"))


def _extract_landmarks_from_video(video_path: pathlib.Path, t_frames: int) -> np.ndarray | None:
    """Run MediaPipe Hands on a video; return (T, 21, 3) float32 or None."""
    try:
        import cv2
        import mediapipe as mp
    except ImportError:
        raise ImportError("pip install mediapipe opencv-python-headless")

    mp_hands = mp.solutions.hands
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None

    frames = []
    with mp_hands.Hands(static_image_mode=False, max_num_hands=1,
                        min_detection_confidence=0.5) as hands:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = hands.process(rgb)
            if result.multi_hand_landmarks:
                lm = result.multi_hand_landmarks[0].landmark
                pts = np.array([[l.x, l.y, l.z] for l in lm], dtype=np.float32)
            else:
                pts = np.zeros((21, 3), dtype=np.float32)
            frames.append(pts)
    cap.release()

    if len(frames) < 5:
        return None

    # Resample to exactly t_frames using linear interpolation
    src = np.stack(frames)  # (F, 21, 3)
    F = src.shape[0]
    idx = np.linspace(0, F - 1, t_frames)
    lo = np.floor(idx).astype(int)
    hi = np.minimum(lo + 1, F - 1)
    alpha = (idx - lo)[:, None, None]
    resampled = src[lo] * (1 - alpha) + src[hi] * alpha
    return resampled.astype(np.float32)


def _build_cache(split: str = "train") -> tuple[np.ndarray, np.ndarray, list[str], np.ndarray]:
    """Extract landmarks from raw videos and cache to .npz."""
    meta_path = RAW_DIR / "WLASL_v0.3.json"
    if not meta_path.exists():
        raise FileNotFoundError(
            f"WLASL metadata not found at {meta_path}. "
            "Download from https://github.com/dxli94/WLASL"
        )

    with open(meta_path) as f:
        meta = json.load(f)

    # Build label list (top MAX_CLASSES by instance count)
    label_counts: dict[str, int] = {}
    for entry in meta:
        label_counts[entry["gloss"]] = len(entry.get("instances", []))
    labels = sorted(label_counts, key=lambda k: -label_counts[k])[:MAX_CLASSES]
    label2idx = {l: i for i, l in enumerate(labels)}

    X_list, y_list, signer_list = [], [], []
    for entry in meta:
        gloss = entry["gloss"]
        if gloss not in label2idx:
            continue
        for inst in entry.get("instances", []):
            if inst.get("split", "train") != split:
                continue
            video_id = inst["video_id"]
            signer_id = str(inst.get("signer_id", "unknown"))
            # Try common video extensions
            for ext in [".mp4", ".mov", ".avi"]:
                vpath = RAW_DIR / "videos" / f"{video_id}{ext}"
                if vpath.exists():
                    break
            else:
                continue
            seq = _extract_landmarks_from_video(vpath, T_FRAMES)
            if seq is None:
                continue
            X_list.append(seq)
            y_list.append(label2idx[gloss])
            signer_list.append(signer_id)

    if not X_list:
        raise RuntimeError(f"No WLASL {split} videos found under {RAW_DIR}/videos/")

    X = np.stack(X_list).astype(np.float32)
    y = np.array(y_list, dtype=np.int64)
    signer_ids = np.array(signer_list)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        CACHE_DIR / f"{split}.npz",
        X=X, y=y, signer_ids=signer_ids,
        labels=np.array(labels),
    )
    print(f"[wlasl] cached {split}: {X.shape[0]} examples, {len(labels)} classes -> {CACHE_DIR}/{split}.npz")
    return X, y, labels, signer_ids


def load_wlasl(split: str = "train", rebuild_cache: bool = False, **_):
    """
    Load WLASL dynamic sign data.
    Returns (X, y, labels, signer_ids) with shapes:
        X: (N, T, 21, 3) float32
        y: (N,) int64
        labels: list[str]
        signer_ids: (N,) str array
    """
    cache_file = CACHE_DIR / f"{split}.npz"
    if cache_file.exists() and not rebuild_cache:
        data = np.load(cache_file, allow_pickle=True)
        X = data["X"]
        y = data["y"]
        labels = list(data["labels"])
        signer_ids = data["signer_ids"]
        print(f"[wlasl] loaded {split} from cache: {X.shape[0]} examples, {len(labels)} classes")
        return X, y, labels, signer_ids
    return _build_cache(split)