"""Train the intent model and write docs/ml-report.md (BUILD_PLAN E2, E5).

    uv run python -m app.ml.train

TF-IDF over word 1-2 grams + character 2-5 grams (robust to Kanglish/Hinglish spelling) ->
LogisticRegression. Text is normalised with the same to_latin() the parser uses, so native-script
input reaches the model as the Latin words it was trained on.

Saves app/ml/artifacts/intent-v1.joblib plus a JSON sidecar with its SHA-256; intent.py refuses
to load an artifact whose hash doesn't match (joblib is pickle: only ever load our own file).
"""

import csv
import hashlib
import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

import joblib
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

from app.ml.intent import ARTIFACT, META, THRESHOLD, VERSION, combine, normalise
from app.ml.parse import INTENTS, parse_request

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
REPORT = ROOT.parents[1] / "docs" / "ml-report.md"
NOW = datetime(2026, 10, 8, 15, 0, tzinfo=UTC)  # fixed clock: deadlines don't change the rules


def load(name: str) -> tuple[list[str], list[str]]:
    with (DATA / name).open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return [r["text"] for r in rows], [r["intent"] for r in rows]


def model() -> Pipeline:
    return Pipeline(
        [
            (
                "features",
                FeatureUnion(
                    [
                        ("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
                        (
                            "char",
                            TfidfVectorizer(
                                analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True
                            ),
                        ),
                    ]
                ),
            ),
            ("clf", LogisticRegression(C=8.0, max_iter=3000, class_weight="balanced")),
        ]
    )


def _table(y_true: list[str], y_pred: list[str]) -> str:
    rep = classification_report(
        y_true, y_pred, labels=list(INTENTS), output_dict=True, zero_division=0
    )
    lines = ["| Intent | Precision | Recall | F1 | Support |", "|---|---|---|---|---|"]
    for k in INTENTS:
        r = rep[k]
        lines.append(
            f"| `{k}` | {r['precision']:.2f} | {r['recall']:.2f} | {r['f1-score']:.2f} | {int(r['support'])} |"
        )
    acc = sum(a == b for a, b in zip(y_true, y_pred, strict=True)) / len(y_true)
    lines.append(f"| **accuracy** | | | **{acc:.2f}** | {len(y_true)} |")
    return "\n".join(lines)


def _confusion(y_true: list[str], y_pred: list[str]) -> str:
    cm = confusion_matrix(y_true, y_pred, labels=list(INTENTS))
    short = [k.replace("important_questions", "imp_q").replace("make_", "") for k in INTENTS]
    head = "| true \\ predicted | " + " | ".join(short) + " |"
    rows = [head, "|---" * (len(INTENTS) + 1) + "|"]
    for name, row in zip(short, cm, strict=True):
        rows.append(f"| {name} | " + " | ".join(str(v) if v else "·" for v in row) + " |")
    return "\n".join(rows)


def main() -> None:
    texts, labels = load("intents.csv")
    hold_x, hold_y = load("intents_holdout.csv")
    norm = [normalise(t) for t in texts]

    # 1) template split: how well it learned the templates (optimistic by construction)
    xtr, xte, ytr, yte = train_test_split(
        norm, labels, test_size=0.2, stratify=labels, random_state=7
    )
    split_pred = list(model().fit(xtr, ytr).predict(xte))

    # 2) final model on everything, judged on the hand-written holdout
    final = model().fit(norm, labels)
    proba = final.predict_proba([normalise(t) for t in hold_x])
    classes = list(final.classes_)
    clf_pred = [classes[int(p.argmax())] for p in proba]
    rule_pred = []
    hybrid_pred = []
    for text, p in zip(hold_x, proba, strict=True):
        parsed = parse_request(text, NOW)
        rule_pred.append(parsed.intent)
        hybrid_pred.append(combine(classes[int(p.argmax())], float(p.max()), parsed.intent))

    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(final, ARTIFACT, compress=3)
    sha = hashlib.sha256(ARTIFACT.read_bytes()).hexdigest()

    def acc(pred: list[str]) -> float:
        return round(sum(a == b for a, b in zip(hold_y, pred, strict=True)) / len(hold_y), 3)

    meta = {
        "version": VERSION,
        "sha256": sha,
        "sklearn": sklearn.__version__,
        "trained_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "train_rows": len(texts),
        "holdout_rows": len(hold_x),
        "threshold": THRESHOLD,
        "holdout_accuracy": {
            "classifier": acc(clf_pred),
            "rules": acc(rule_pred),
            "hybrid": acc(hybrid_pred),
        },
    }
    META.write_text(json.dumps(meta, indent=1), encoding="utf-8")

    counts = Counter(labels)
    REPORT.write_text(
        f"""# ML report: intent model

Generated by `uv run python -m app.ml.train` on {meta["trained_at"][:10]}. Do not edit by hand; re-run the script.

## What it is

Every student message is classified into one of {len(INTENTS)} intents **before** any AI call (PRD F5). The model is
TF-IDF (word 1-2 grams + character 2-5 grams) → LogisticRegression (scikit-learn {sklearn.__version__}), trained on
`apps/api/data/intents.csv`. Text is first normalised by the parser's `to_latin()`, so Kannada and Devanagari script
and Kanglish/Hinglish reach the model as the Latin words it learned.

In production the **hybrid** is used: the classifier's answer when its confidence is ≥ {THRESHOLD}, otherwise the
hand-written rules in `app/ml/parse.py` (the same rules as the web demo). Artifact `{ARTIFACT.name}`,
SHA-256 `{sha[:16]}…` (checked before loading).

## Data

{len(texts)} labelled lines, synthetic: templates × real subjects, topics, time phrases and file names, in English,
Kanglish, Hinglish and native script. **No student data.** Regenerate with `uv run python data/build_intents.py`.

| Intent | Lines |
|---|---|
"""
        + "\n".join(f"| `{k}` | {counts[k]} |" for k in INTENTS)
        + f"""

## Results

### Hand-written holdout ({len(hold_x)} lines, phrasings not from the templates) — the honest number

| Approach | Accuracy |
|---|---|
| Classifier alone | {meta["holdout_accuracy"]["classifier"]:.2f} |
| Rules alone | {meta["holdout_accuracy"]["rules"]:.2f} |
| **Hybrid (what ships)** | **{meta["holdout_accuracy"]["hybrid"]:.2f}** |

Per intent, hybrid:

{_table(hold_y, hybrid_pred)}

Confusion matrix (hybrid, holdout):

{_confusion(hold_y, hybrid_pred)}

### Template split (20% of `intents.csv`) — optimistic by construction

Train and test lines come from the same templates, so this mostly shows the model learned them.

{_table(yte, split_pred)}

## Known weaknesses

- **Synthetic training data.** Real students will phrase things the templates never did. The holdout exists to keep
  this honest; replace both sets with consented, anonymised real messages before claiming production accuracy.
- **Polite or indirect phrasing** is the main failure: "can you push everything by one day" is read as small talk
  instead of `edit_plan`; "ask me 10 multiple choice questions" as `important_questions` instead of `make_quiz`;
  "what is the capital of france" as `explain_topic`. More varied, real phrasings fix this, not more templates.
- The rules in `app/ml/parse.py` score only 0.36 on the holdout, so the hybrid trusts the model down to a
  confidence of {THRESHOLD}; the rules are the backstop for a missing model, not a second opinion.
- **Small holdout** ({len(hold_x)} lines), so one mistake moves a per-intent number a lot.
- **`ask_about_file` vs `summarize_file` vs `explain_topic`** overlap in meaning; the confusion matrix shows where.
- **`out_of_scope` is open-ended.** Anything unlike the training lines may be pulled toward a study intent. The reply
  layer still answers safely (an open question goes to the AI with study-assistant rules).
- Kannada/Hindi **script** coverage depends on the word table in `app/ml/data/script_words.json`; unknown script
  words pass through unchanged and the model sees them as unfamiliar characters.
""",
        encoding="utf-8",
    )
    print(json.dumps(meta["holdout_accuracy"]), f"artifact={ARTIFACT.name}", f"report={REPORT}")


if __name__ == "__main__":
    main()
