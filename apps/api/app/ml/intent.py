"""Intent classifier, loaded once per warm instance (BUILD_PLAN E2).

predict() returns the hybrid answer: the model when it is confident, otherwise the parser's
rules. If the artifact is missing or its hash doesn't match the sidecar, the rules are used
alone; the app keeps working, just without the model.
"""

import hashlib
import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib

from app.ml.parse import to_latin

VERSION = "intent-v1"
THRESHOLD = 0.15  # swept on the holdout: higher values let the weaker rules override the model
ARTIFACT = Path(__file__).parent / "artifacts" / f"{VERSION}.joblib"
META = ARTIFACT.with_suffix(".json")
log = logging.getLogger("api")


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", to_latin(text).lower()).strip()


@lru_cache
def _model() -> Any | None:
    try:
        meta = json.loads(META.read_text("utf-8"))
        data = ARTIFACT.read_bytes()
    except OSError:
        log.warning("intent model missing; using rules only")
        return None
    if hashlib.sha256(data).hexdigest() != meta.get("sha256"):
        log.error("intent model hash mismatch; refusing to load it")
        return None
    return joblib.load(ARTIFACT)


def combine(model_intent: str, confidence: float, rule_intent: str) -> str:
    return model_intent if confidence >= THRESHOLD else rule_intent


def predict(text: str, rule_intent: str) -> tuple[str, float]:
    """(intent, model confidence). Confidence is 0.0 when the rules decided."""
    m = _model()
    if m is None:
        return rule_intent, 0.0
    proba = m.predict_proba([normalise(text)])[0]
    best = int(proba.argmax())
    intent = combine(str(m.classes_[best]), float(proba[best]), rule_intent)
    return intent, float(proba[best]) if intent != rule_intent or proba[best] >= THRESHOLD else 0.0
