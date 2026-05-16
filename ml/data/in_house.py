"""
ml/data/in_house.py  — In-house native-signer recording loader.
dataset_id: in_house  (must match ml/data/LICENSES.md)

Reads from a manifest JSON at ml/data/in_house_manifest.json.
Manifest format:
  [
    {
      "video_path": "path/to/video.mp4",
      "signer_id": "signer_001",
      "label": "HELLO",
      "type": "dynamic",   // or "static"
      "split": "train"     // train | val | test
    },
    ...
  ]

This is a placeholder loader. Populate the manifest before the native-signer
recording sprint (PDR S-18/S-19). The loader interface is identical to wlasl.py
so no downstream code changes are needed when real data arrives.
"""
from __future__ import annotations
import json, os, pathlib
import numpy as np

DATASET_ID = "in_house"
MANIFEST_PATH = pathlib.Path(os.environ.get("IN_HOUSE_MANIFEST", "ml/data/in_house_manifest.json"))
CACHE_DIR = pathlib.Path(os.environ.get("IN_HOUSE_CACHE_DIR", "ml/data/cache/in_house"))
T_FRAMES = int(os.environ.get("IN_HOUSE_T_FRAMES", "45"))


def _extract_landmarks_from_video(video_path: pathlib.Path, t_frames: int) -> "np.ndarray | None":
    """Shared extraction logic — identical to wlasl.py."""
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


def _load_manifest(sign_type: str, split: str):
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(
            f"In-house manifest not found at {MANIFEST_PATH}. "
            "Create it before the native-signer recording sprint."
        )
    with open(MANIFEST_PATH) as f:
        records = json.load(f)
    return [r for r in records if r.get("type") == sign_type and r.get("split") == split]


def load_static_in_house(split: str = "train", rebuild_cache: bool = False, **_):
    cache_file = CACHE_DIR / f"static_{split}.npz"
    if cache_file.exists() and not rebuild_cache:
        data = np.load(cache_file, allow_pickle=True)
        return data["X"], data["y"], list(data["labels"]), data["signer_ids"]
    records = _load_manifest("static", split)
    if not records:
        raise RuntimeError(f"No in-house static {split} records in manifest.")
    labels = sorted(set(r["label"] for r in records))
    label2idx = {l: i for i, l in enumerate(labels)}
    X_list, y_list, signer_list = [], [], []
    for r in records:
        seq = _extract_landmarks_from_video(pathlib.Path(r["video_path"]), 1)
        lm = seq[0] if seq is not None else np.zeros((21, 3), dtype=np.float32)
        X_list.append(lm)
        y_list.append(label2idx[r["label"]])
        signer_list.append(r["signer_id"])
    X = np.stack(X_list).astype(np.float32)
    y = np.array(y_list, dtype=np.int64)
    signer_ids = np.array(signer_list)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cache_file, X=X, y=y, signer_ids=signer_ids, labels=np.array(labels))
    return X, y, labels, signer_ids


def load_dynamic_in_house(split: str = "train", rebuild_cache: bool = False, **_):
    cache_file = CACHE_DIR / f"dynamic_{split}.npz"
    if cache_file.exists() and not rebuild_cache:
        data = np.load(cache_file, allow_pickle=True)
        return data["X"], data["y"], list(data["labels"]), data["signer_ids"]
    records = _load_manifest("dynamic", split)
    if not records:
        raise RuntimeError(f"No in-house dynamic {split} records in manifest.")
    labels = sorted(set(r["label"] for r in records))
    label2idx = {l: i for i, l in enumerate(labels)}
    X_list, y_list, signer_list = [], [], []
    for r in records:
        seq = _extract_landmarks_from_video(pathlib.Path(r["video_path"]), T_FRAMES)
        if seq is None:
            seq = np.zeros((T_FRAMES, 21, 3), dtype=np.float32)
        X_list.append(seq)
        y_list.append(label2idx[r["label"]])
        signer_list.append(r["signer_id"])
    X = np.stack(X_list).astype(np.float32)
    y = np.array(y_list, dtype=np.int64)
    signer_ids = np.array(signer_list)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cache_file, X=X, y=y, signer_ids=signer_ids, labels=np.array(labels))
    return X, y, labels, signer_ids