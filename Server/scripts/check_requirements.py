"""Compare third-party imports in app/ and scripts/ with requirements.txt. Run: python -m scripts.check_requirements"""
import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCAL = {"app", "scripts", "alembic"}
IMPORT_TO_DIST = {
    "fitz": "pymupdf", "pymupdf": "pymupdf", "jwt": "pyjwt", "argon2": "argon2-cffi", "multipart": "python-multipart",
    "pydantic_settings": "pydantic-settings", "email_validator": "email-validator", "starlette": "fastapi",
}


def main() -> int:
    declared = {re.split(r"[<>=\[ ]", line.strip(), 1)[0].lower().replace("_", "-")
                for line in (ROOT / "requirements.txt").read_text().splitlines()
                if line.strip() and not line.startswith("#")}
    used: dict[str, set[str]] = {}
    for folder in ("app", "scripts", "alembic"):
        for path in (ROOT / folder).rglob("*.py"):
            for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
                names = [a.name for a in node.names] if isinstance(node, ast.Import) else (
                    [node.module] if isinstance(node, ast.ImportFrom) and node.level == 0 and node.module else [])
                for name in names:
                    top = name.split(".")[0]
                    if top not in LOCAL and top not in sys.stdlib_module_names:
                        used.setdefault(IMPORT_TO_DIST.get(top, top).lower().replace("_", "-"), set()).add(str(path.relative_to(ROOT)))
    missing = {d: sorted(f)[:2] for d, f in used.items() if d not in declared}
    for dist, files in sorted(missing.items()):
        print(f"MISSING from requirements.txt: {dist}  (used in {', '.join(files)})")
    print("All imports are declared." if not missing else "Add the packages above (if an import is an optional or transitive one, ignore it).")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())