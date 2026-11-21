"""Scikit-learn ML workflow package owned by apps/backend."""

from pathlib import Path

ML_BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATASET_CONFIG_PATH = ML_BASE_DIR / "configs" / "dataset.yaml"

