"""Shared fixtures. Tests run against the configured database inside a transaction that is
rolled back at the end, so nothing is left behind."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import engine, get_db
from app.core.rate_limit import reset_all_limiters
from app.main import app


@pytest.fixture()
def db_session():
    connection = engine.connect()
    outer = connection.begin()
    # create_savepoint: app code may call commit(); only the savepoint is released, the outer tx rolls back.
    session = Session(bind=connection, join_transaction_mode="create_savepoint", autoflush=False, expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        outer.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    reset_all_limiters()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()