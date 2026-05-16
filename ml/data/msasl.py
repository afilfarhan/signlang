"""
ml/data/msasl.py  — Microsoft ASL loader.
dataset_id: msasl  (must match ml/data/LICENSES.md entry)

MS-ASL provides ~25,000 video instances across 1,000 ASL word classes.
Same interface as wlasl.py; same MediaPipe extraction pipeline.

Prerequisites:
    pip install mediapipe opencv-python-headless
    # Download MS-ASL videos and metadata to ml/data/raw/msasl/
    # See https://www.microsoft.com/en-us/research/project/ms-asl/

Environment variables:
    MSASL_RAW_DIR    path to raw MS-ASL directory (default: ml/data/raw/msasl)
    MSASL_CACHE_DIR  path to cache directory      (default: ml/data/cache/msasl)
    MSASL_MAX_CLASSES  max classes to load (default: 200)
    MSASL_T_FRAMES     target sequence length (default: 45)
"""
from __future__ import annotations
import json, os, pathlib
import numpy as np

DATASET_ID = "msasl"

RAW_DIR   = pathlib.Path(os.environ.get("MSASL_RAW_DIR",   "ml/data/raw/msasl"))
CACHE_DIR = pathlib.Path(os.environ.get("MSASL_CACHE_DIR", "ml/data/cache/msasl"))
MAX_CLASSES = int(os.environ.get("MSASL_MAX_CLASSES", "200"))
T_FRAMES    = int(os.environ.get("MSASL_T_FRAMES",    "45"))


def _extract_landmarks_from_video(video_path: pathlib.Path, t_frames: int) -> "np.ndarray | None":
    """Identical to wlasl.py — shared extraction logic."""
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
    src = np.stack(frames)
    F = src.shape[0]
    idx = np.linspace(0, F - 1, t_frames)
    lo = np.floor(idx).astype(int)
    hi = np.minimum(lo + 1, F - 1)
    alpha = (idx - lo)[:, None, None]
    return (src[lo] * (1 - alpha) + src[hi] * alpha).astype(np.float32)


def _build_cache(split: str = "train"):
    """MS-ASL metadata is a list of dicts with keys: clean_text, signer_id, label, file."""
    for fname in ["MSASL_train.json", "MSASL_val.json", "MSASL_test.json"]:
        if (RAW_DIR / fname).exists():
            break
    else:
        raise FileNotFoundError(
            f"MS-ASL metadata not found under {RAW_DIR}. "
            "Download from https://www.microsoft.com/en-us/research/project/ms-asl/"
        )

    split_map = {"train": "MSASL_train.json", "val": "MSASL_val.json", "test": "MSASL_test.json"}
    with open(RAW_DIR / split_map[split]) as f:
        records = json.load(f)

    # Build label list
    from collections import Counter
    label_counts = Counter(r["clean_text"] for r in records)
    labels = [l for l, _ in label_counts.most_common(MAX_CLASSES)]
    label2idx = {l: i for i, l in enumerate(labels)}

    X_list, y_list, signer_list = [], [], []
    for r in records:
        gloss = r.get("clean_text", "")
        if gloss not in label2idx:
            continue
        signer_id = str(r.get("signer_id", "unknown"))
        vpath = RAW_DIR / "videos" / r.get("file", "")
        if not vpath.exists():
            continue
        seq = _extract_landmarks_from_video(vpath, T_FRAMES)
        if seq is None:
            continue
        X_list.append(seq)
        y_list.append(label2idx[gloss])
        signer_list.append(signer_id)

    if not X_list:
        raise RuntimeError(f"No MS-ASL {split} videos found under {RAW_DIR}/videos/")

    X = np.stack(X_list).astype(np.float32)
    y = np.array(y_list, dtype=np.int64)
    signer_ids = np.array(signer_list)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(CACHE_DIR / f"{split}.npz", X=X, y=y, signer_ids=signer_ids, labels=np.array(labels))
    print(f"[msasl] cached {split}: {X.shape[0]} examples -> {CACHE_DIR}/{split}.npz")
    return X, y, labels, signer_ids


def load_msasl(split: str = "train", rebuild_cache: bool = False, **_):
    cache_file = CACHE_DIR / f"{split}.npz"
    if cache_file.exists() and not rebuild_cache:
        data = np.load(cache_file, allow_pickle=True)
        return data["X"], data["y"], list(data["labels"]), data["signer_ids"]
    return _build_cache(split)