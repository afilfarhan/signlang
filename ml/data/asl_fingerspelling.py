"""
ml/data/asl_fingerspelling.py
Loaders for static fingerspelling datasets.
dataset_ids: chicagofs, asl_citizen  (must match ml/data/LICENSES.md)

ChicagoFSWild+ (CC BY 4.0): ~7,000 fingerspelling sequences, 26 letters.
ASL Citizen (CC BY 4.0): 2,731 ASL signs, 52 signers, excellent diversity.

Both loaders follow the same pattern:
  1. Read metadata CSV/JSON from ml/data/raw/{dataset}/
  2. Run MediaPipe Hands offline to extract (21, 3) per-frame landmarks.
  3. Cache to ml/data/cache/{dataset}/{split}.npz (gitignored).
  4. Return (X, y, labels, signer_ids) matching the v2 loader contract.
     X shape: (N, 21, 3) float32  -- single-frame static signs
"""
from __future__ import annotations
import os, pathlib, csv
import numpy as np

CHICAGOFS_RAW   = pathlib.Path(os.environ.get("CHICAGOFS_RAW_DIR",   "ml/data/raw/chicagofs"))
CHICAGOFS_CACHE = pathlib.Path(os.environ.get("CHICAGOFS_CACHE_DIR", "ml/data/cache/chicagofs"))
ASL_CITIZEN_RAW   = pathlib.Path(os.environ.get("ASL_CITIZEN_RAW_DIR",   "ml/data/raw/asl_citizen"))
ASL_CITIZEN_CACHE = pathlib.Path(os.environ.get("ASL_CITIZEN_CACHE_DIR", "ml/data/cache/asl_citizen"))

LETTERS_26 = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def _extract_static_landmark(image_path: pathlib.Path) -> "np.ndarray | None":
    """Run MediaPipe Hands on a single image; return (21, 3) float32 or None."""
    try:
        import cv2
        import mediapipe as mp
    except ImportError:
        raise ImportError("pip install mediapipe opencv-python-headless")
    mp_hands = mp.solutions.hands
    img = cv2.imread(str(image_path))
    if img is None:
        return None
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    with mp_hands.Hands(static_image_mode=True, max_num_hands=1,
                        min_detection_confidence=0.5) as hands:
        result = hands.process(rgb)
    if not result.multi_hand_landmarks:
        return None
    lm = result.multi_hand_landmarks[0].landmark
    return np.array([[l.x, l.y, l.z] for l in lm], dtype=np.float32)


def _extract_static_from_video_frame(video_path: pathlib.Path) -> "np.ndarray | None":
    """Extract a single representative frame from a short fingerspelling clip."""
    try:
        import cv2
        import mediapipe as mp
    except ImportError:
        raise ImportError("pip install mediapipe opencv-python-headless")
    mp_hands = mp.solutions.hands
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None
    best = None
    with mp_hands.Hands(static_image_mode=False, max_num_hands=1,
                        min_detection_confidence=0.6) as hands:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = hands.process(rgb)
            if result.multi_hand_landmarks:
                lm = result.multi_hand_landmarks[0].landmark
                best = np.array([[l.x, l.y, l.z] for l in lm], dtype=np.float32)
    cap.release()
    return best


# ---- ChicagoFSWild+ -------------------------------------------------------

def _build_chicagofs_cache(split: str = "train"):
    """
    ChicagoFSWild+ directory layout expected:
        ml/data/raw/chicagofs/
            metadata.csv   (columns: filename, label, signer_id, split)
            images/        (PNG/JPG frames)
    """
    meta_path = CHICAGOFS_RAW / "metadata.csv"
    if not meta_path.exists():
        raise FileNotFoundError(
            f"ChicagoFSWild+ metadata not found at {meta_path}. "
            "Download from https://home.ttic.edu/~klivescu/ChicagoFSWild.htm"
        )
    X_list, y_list, signer_list = [], [], []
    label2idx = {l: i for i, l in enumerate(LETTERS_26)}
    with open(meta_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("split", "train") != split:
                continue
            label = row["label"].upper()
            if label not in label2idx:
                continue
            img_path = CHICAGOFS_RAW / "images" / row["filename"]
            if not img_path.exists():
                continue
            lm = _extract_static_landmark(img_path)
            if lm is None:
                lm = np.zeros((21, 3), dtype=np.float32)
            X_list.append(lm)
            y_list.append(label2idx[label])
            signer_list.append(str(row.get("signer_id", "unknown")))
    if not X_list:
        raise RuntimeError(f"No ChicagoFSWild+ {split} images found under {CHICAGOFS_RAW}/images/")
    X = np.stack(X_list).astype(np.float32)
    y = np.array(y_list, dtype=np.int64)
    signer_ids = np.array(signer_list)
    CHICAGOFS_CACHE.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(CHICAGOFS_CACHE / f"{split}.npz",
                        X=X, y=y, signer_ids=signer_ids, labels=np.array(LETTERS_26))
    print(f"[chicagofs] cached {split}: {X.shape[0]} examples -> {CHICAGOFS_CACHE}/{split}.npz")
    return X, y, LETTERS_26, signer_ids


def load_chicagofs(split: str = "train", rebuild_cache: bool = False, **_):
    """Load ChicagoFSWild+ static fingerspelling data."""
    cache_file = CHICAGOFS_CACHE / f"{split}.npz"
    if cache_file.exists() and not rebuild_cache:
        data = np.load(cache_file, allow_pickle=True)
        return data["X"], data["y"], list(data["labels"]), data["signer_ids"]
    return _build_chicagofs_cache(split)


# ---- ASL Citizen ----------------------------------------------------------

def _build_asl_citizen_cache(split: str = "train"):
    """
    ASL Citizen directory layout expected:
        ml/data/raw/asl_citizen/
            splits.csv     (columns: Video file, Gloss, Signer ID, Split)
            videos/        (MP4 files)
    """
    meta_path = ASL_CITIZEN_RAW / "splits.csv"
    if not meta_path.exists():
        raise FileNotFoundError(
            f"ASL Citizen metadata not found at {meta_path}. "
            "Download from https://www.microsoft.com/en-us/research/project/asl-citizen/"
        )
    # Build label list from all splits first
    all_labels: set[str] = set()
    with open(meta_path, newline="") as f:
        for row in csv.DictReader(f):
            all_labels.add(row["Gloss"].upper())
    labels = sorted(all_labels)
    label2idx = {l: i for i, l in enumerate(labels)}

    X_list, y_list, signer_list = [], [], []
    split_map = {"train": "train", "val": "val", "test": "test"}
    with open(meta_path, newline="") as f:
        for row in csv.DictReader(f):
            if row.get("Split", "train").lower() != split_map.get(split, split):
                continue
            gloss = row["Gloss"].upper()
            if gloss not in label2idx:
                continue
            vpath = ASL_CITIZEN_RAW / "videos" / row["Video file"]
            if not vpath.exists():
                continue
            lm = _extract_static_from_video_frame(vpath)
            if lm is None:
                lm = np.zeros((21, 3), dtype=np.float32)
            X_list.append(lm)
            y_list.append(label2idx[gloss])
            signer_list.append(str(row.get("Signer ID", "unknown")))
    if not X_list:
        raise RuntimeError(f"No ASL Citizen {split} videos found under {ASL_CITIZEN_RAW}/videos/")
    X = np.stack(X_list).astype(np.float32)
    y = np.array(y_list, dtype=np.int64)
    signer_ids = np.array(signer_list)
    ASL_CITIZEN_CACHE.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(ASL_CITIZEN_CACHE / f"{split}.npz",
                        X=X, y=y, signer_ids=signer_ids, labels=np.array(labels))
    print(f"[asl_citizen] cached {split}: {X.shape[0]} examples -> {ASL_CITIZEN_CACHE}/{split}.npz")
    return X, y, labels, signer_ids


def load_asl_citizen(split: str = "train", rebuild_cache: bool = False, **_):
    """Load ASL Citizen static sign data."""
    cache_file = ASL_CITIZEN_CACHE / f"{split}.npz"
    if cache_file.exists() and not rebuild_cache:
        data = np.load(cache_file, allow_pickle=True)
        return data["X"], data["y"], list(data["labels"]), data["signer_ids"]
    return _build_asl_citizen_cache(split)