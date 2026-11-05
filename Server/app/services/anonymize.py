"""Strip personal attributes before scoring (hard rule: name, gender, age, photo, address, nationality, ...).

Pure functions, no database or AI. matching.compute() never reads these fields anyway; this module makes
that a guarantee for the free text too (for example an "Age: 29" line or an email that contains a skill word).
Known limit: indirect proxies such as graduation years or school names are NOT removed.
"""
import re

from app.services.parsing import EMAIL_RE, PHONE_RE, URL_RE

_LABELS = [
    "full name", "surname", "father's name", "photo", "photograph", "picture", "gender", "sex", "pronouns",
    "age", "date of birth", "dob", "birth date", "birthdate", "place of birth", "nationality", "citizenship",
    "marital status", "religion", "ethnicity", "race", "address", "home address", "location", "city",
    "country", "residence", "hometown",
]
# a whole line such as "Gender: Female" or "Age - 29" (the label must start the line)
_ATTR_LINE = re.compile(
    r"^[ \t]*(?:" + "|".join(re.escape(x) for x in sorted(_LABELS, key=len, reverse=True)) + r")[ \t]*[:\-\u2013\u2014][^\n]*$",
    re.I | re.M,
)
_DROP_KEYS = {"address", "gender", "age", "dob", "nationality", "photo", "photo_url", "location"}


def _drop_phone(match: re.Match) -> str:
    digits = re.sub(r"\D", "", match.group())
    return " " if 9 <= len(digits) <= 15 else match.group()  # same guard as parsing.extract_contacts


def strip_for_scoring(resume: dict, text: str) -> tuple[dict, str]:
    """Return (resume dict, resume text) without personal attributes. Inputs are not modified."""
    clean = {k: v for k, v in resume.items() if k not in _DROP_KEYS}
    clean.update(name=None, email=None, phone=None, links=[])

    out = _ATTR_LINE.sub("", text or "")
    name = (resume.get("name") or "").strip()
    if len(name) >= 3:
        out = re.sub(re.escape(name), " ", out, flags=re.I)
    out = EMAIL_RE.sub(" ", out)
    out = PHONE_RE.sub(_drop_phone, out)
    out = URL_RE.sub(" ", out)
    return clean, re.sub(r"\n{3,}", "\n\n", out)