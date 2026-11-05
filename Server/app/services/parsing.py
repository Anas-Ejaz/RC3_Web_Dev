"""Upload validation and PDF text extraction (PyMuPDF first, pdfplumber fallback)."""
import io
import re

import pymupdf

from app.core.config import settings
from app.core.errors import AppError

MIN_TEXT_CHARS = 40
MAX_PAGES = 15
MAX_TEXT_CHARS = 30000

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?<![\w/])\+?\d[\d ().\-]{7,18}\d(?!\w)")
URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\"')]+|(?:linkedin\.com|github\.com)/[^\s<>\"')]+", re.I)


class PdfError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def validate_upload(filename: str | None, data: bytes) -> None:
    """Reject bad uploads before parsing: size, extension AND the real %PDF- signature."""
    if len(data) > settings.max_upload_bytes:
        raise AppError(413, "FILE_TOO_LARGE", f"File exceeds the {settings.max_upload_mb} MB limit")
    if not data:
        raise AppError(422, "EMPTY_FILE", "The uploaded file is empty")
    if not filename or not filename.lower().endswith(".pdf"):
        raise AppError(415, "UNSUPPORTED_FILE_TYPE", "Only PDF resumes are supported")
    if not data.startswith(b"%PDF-"):
        raise AppError(415, "UNSUPPORTED_FILE_TYPE", "File content is not a valid PDF")


def clean_text(text: str) -> str:
    text = text.replace("\x00", " ").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:MAX_TEXT_CHARS]


def _extract_pymupdf(data: bytes) -> str:
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        if doc.needs_pass:
            raise PdfError("PDF_ENCRYPTED", "The PDF is password-protected.")
        return "\n".join(doc.load_page(i).get_text() for i in range(min(doc.page_count, MAX_PAGES)))


def _extract_pdfplumber(data: bytes) -> str:
    import pdfplumber

    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return "\n".join((page.extract_text() or "") for page in pdf.pages[:MAX_PAGES])


def extract_text(data: bytes) -> str:
    """Return cleaned text, or "" if the PDF has no readable text (e.g. scanned images).

    Raises PdfError for encrypted or unreadable files.
    """
    text, primary_failed = "", False
    try:
        text = _extract_pymupdf(data)
    except PdfError:
        raise
    except Exception:  # noqa: BLE001 - corrupt file; try the fallback parser
        primary_failed = True
    if len(clean_text(text)) < MIN_TEXT_CHARS:
        try:
            text = _extract_pdfplumber(data)
        except Exception:  # noqa: BLE001
            if primary_failed:
                raise PdfError("PDF_CORRUPT", "The PDF could not be read; it may be corrupted.")
    cleaned = clean_text(text)
    return cleaned if len(cleaned) >= MIN_TEXT_CHARS else ""


def extract_contacts(text: str) -> tuple[str | None, str | None, list[str]]:
    """Deterministic email/phone/links extraction in code (not LLM) to avoid hallucinated contact data."""
    email = next(iter(EMAIL_RE.findall(text)), None)
    phone = None
    for m in PHONE_RE.finditer(text):
        if 9 <= len(re.sub(r"\D", "", m.group())) <= 15:
            phone = m.group().strip()
            break
    links: list[str] = []
    seen: set[str] = set()
    for m in URL_RE.findall(text):
        url = m.rstrip(".,;)")
        if url.lower() not in seen:
            seen.add(url.lower())
            links.append(url[:300])
    return (email.lower() if email else None), phone, links[:10]