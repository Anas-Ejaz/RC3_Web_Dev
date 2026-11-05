"""Uniform error format required by the API contract:
{"detail": str, "code": str, "fields"?: {field: message}}
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.errors")

_STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
}


class AppError(Exception):
    """Domain error raised by services/routers; rendered in the contract's error shape."""

    def __init__(
        self,
        status_code: int,
        code: str,
        detail: str,
        fields: dict[str, str] | None = None,
        extra: dict | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.detail = detail
        self.fields = fields
        self.extra = extra or {}  # e.g. {"conflicts": [...]} for SCHEDULING_CONFLICT
        super().__init__(detail)


def _body(detail: str, code: str, fields: dict[str, str] | None = None, extra: dict | None = None) -> dict:
    body: dict = {"detail": detail, "code": code}
    if fields:
        body["fields"] = fields
    if extra:
        body.update(extra)
    return body


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(exc.detail, exc.code, exc.fields, exc.extra),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_CODES.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(str(exc.detail), code),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for err in exc.errors():
            # loc looks like ("body", "email"); drop the leading source segment.
            loc = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
            fields[".".join(loc) or "request"] = err["msg"]
        return JSONResponse(
            status_code=422,
            content=_body("Validation failed", "VALIDATION_ERROR", fields),
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        # Log type and route only: never request bodies (could contain resume text) or secrets.
        logger.error("Unhandled %s on %s %s", type(exc).__name__, request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content=_body("Internal server error", "INTERNAL_ERROR"),
        )