import pytest

from app.services.normalize import normalize_skill


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("JS", "JavaScript"), ("js", "JavaScript"), ("Postgres", "PostgreSQL"), ("k8s", "Kubernetes"),
        ("  node js ", "Node.js"), ("Python 3.11", "Python"), ("ReactJS", "React"), ("C++", "C++"),
        ("Apache Airflow", "Apache Airflow"),  # unknown skills pass through unchanged
    ],
)
def test_normalize_skill(raw, expected):
    assert normalize_skill(raw) == expected