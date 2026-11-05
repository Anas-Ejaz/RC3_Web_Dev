"""Evidence verification: every AI-claimed excerpt must be found (fuzzy) in the real resume text."""
import re

from rapidfuzz import fuzz


def normalize_text(value: str) -> str:
    value = re.sub(r"[•·▪●◦]", " ", value.lower()).replace("…", " ").replace("...", " ")
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    return re.sub(r"\s+", " ", value).strip()


def verify_excerpt(excerpt: str, resume_text: str, threshold: float = 88.0) -> bool:
    """True if the excerpt appears in the resume text (exact, or fuzzy for longer excerpts)."""
    ex, text = normalize_text(excerpt or ""), normalize_text(resume_text or "")
    if len(ex) < 3 or not text:
        return False
    if ex in text:
        return True
    if len(ex) < 12:  # too short for fuzzy matching to be meaningful
        return False
    return fuzz.partial_ratio(ex, text) >= threshold


def _mentions(term: str, excerpt_norm: str) -> bool:
    t = normalize_text(term)
    if not t:
        return False
    if len(t) <= 3 or not t.replace(" ", "").isalnum():  # tiny or symbolic names: c, c++, node.js
        return re.search(rf"(?<![\w+#]){re.escape(t)}(?![\w+#])", excerpt_norm) is not None
    if t in excerpt_norm:
        return True
    return len(t) >= 5 and fuzz.partial_ratio(t, excerpt_norm) >= 90


def verify_skill(raw: str, normalized: str, excerpt: str, resume_text: str) -> bool:
    """A skill is verified only if its excerpt is real AND the excerpt actually mentions the skill."""
    if not verify_excerpt(excerpt, resume_text):
        return False
    ex = normalize_text(excerpt)
    return _mentions(raw, ex) or _mentions(normalized, ex)