from app.services.verification import verify_excerpt, verify_skill

TEXT = "Built REST APIs with Django and PostgreSQL.\nDeployed services using Docker on AWS."


def test_exact_excerpt_verified():
    assert verify_excerpt("Built REST APIs with Django and PostgreSQL.", TEXT)


def test_whitespace_and_case_ignored():
    assert verify_excerpt("built rest apis with   django\nand postgresql", TEXT)


def test_small_typo_still_verified():
    assert verify_excerpt("Built REST APIs with Djangoo and PostgreSQL.", TEXT)


def test_fabricated_excerpt_rejected():
    assert not verify_excerpt("Led a team of 12 engineers at Google", TEXT)


def test_empty_excerpt_rejected():
    assert not verify_excerpt("", TEXT)


def test_skill_must_appear_in_its_excerpt():
    assert not verify_skill("Kubernetes", "Kubernetes", "Deployed services using Docker on AWS.", TEXT)


def test_alias_skill_verified_via_normalized_name():
    assert verify_skill("Postgres", "PostgreSQL", "Built REST APIs with Django and PostgreSQL.", TEXT)