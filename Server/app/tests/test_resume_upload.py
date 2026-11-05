"""Upload validation and graceful parse failures (none of these reach Groq)."""
import pymupdf

from app.core.config import settings

PW = "Str0ng-Passw0rd"


def _register(client, email, role):
    assert client.post("/api/v1/auth/register", json={"email": email, "password": PW, "full_name": "T U", "role": role}).status_code == 201


def _upload(client, name, content, ctype="application/pdf"):
    return client.post("/api/v1/candidate/resume", files={"file": (name, content, ctype)})


def test_recruiter_cannot_upload_resume(client):
    _register(client, "ur1@example.com", "recruiter")
    assert _upload(client, "cv.pdf", b"%PDF-1.4 x").status_code == 403


def test_wrong_extension_rejected(client):
    _register(client, "uc1@example.com", "candidate")
    res = _upload(client, "cv.txt", b"hello world", "text/plain")
    assert res.status_code == 415 and res.json()["code"] == "UNSUPPORTED_FILE_TYPE"


def test_pdf_extension_with_wrong_signature_rejected(client):
    _register(client, "uc2@example.com", "candidate")
    res = _upload(client, "cv.pdf", b"MZ this is an exe pretending to be a pdf")
    assert res.status_code == 415


def test_oversize_file_rejected(client):
    _register(client, "uc3@example.com", "candidate")
    res = _upload(client, "cv.pdf", b"%PDF-" + b"0" * settings.max_upload_bytes)
    assert res.status_code == 413 and res.json()["code"] == "FILE_TOO_LARGE"


def test_empty_file_rejected(client):
    _register(client, "uc4@example.com", "candidate")
    res = _upload(client, "cv.pdf", b"")
    assert res.status_code == 422 and res.json()["code"] == "EMPTY_FILE"


def test_corrupt_pdf_does_not_crash(client):
    _register(client, "uc5@example.com", "candidate")
    res = _upload(client, "cv.pdf", b"%PDF-1.4\nthis is not really a pdf")
    assert res.status_code == 200
    body = res.json()
    assert body["parse_status"] in ("failed", "empty") and body["error_message"]


def test_blank_pdf_is_marked_empty(client):
    doc = pymupdf.open()
    doc.new_page()
    data = doc.tobytes()
    doc.close()
    _register(client, "uc6@example.com", "candidate")
    res = _upload(client, "scan.pdf", data)
    assert res.status_code == 200 and res.json()["parse_status"] == "empty"
    assert client.get("/api/v1/candidate/resume").json()["parse_status"] == "empty"


def test_get_resume_404_before_upload(client):
    _register(client, "uc7@example.com", "candidate")
    assert client.get("/api/v1/candidate/resume").status_code == 404


def test_profile_roundtrip(client):
    _register(client, "uc8@example.com", "candidate")
    payload = {"headline": "Backend dev", "phone": "+92 300 1234567", "location": "Lahore", "interests": ["APIs"], "summary": "Hi"}
    assert client.put("/api/v1/candidate/profile", json=payload).status_code == 200
    assert client.get("/api/v1/candidate/profile").json() == payload