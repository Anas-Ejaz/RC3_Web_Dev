"""Skill normalization (JS -> JavaScript, k8s -> Kubernetes, ...).

Callers keep BOTH the raw text and the normalized name. Unknown skills pass through unchanged.
"""
import re

# canonical name -> aliases (the canonical name itself is always accepted too)
_CANONICAL: dict[str, list[str]] = {
    "JavaScript": ["js", "java script", "ecmascript", "es6"],
    "TypeScript": ["ts"],
    "Python": ["py", "python3", "python 3"],
    "Django": [],
    "Django REST Framework": ["drf", "django rest framework", "django-rest-framework"],
    "Flask": [],
    "FastAPI": ["fast api"],
    "PostgreSQL": ["postgres", "psql", "pgsql", "postgre sql"],
    "MySQL": ["my sql"],
    "MongoDB": ["mongo", "mongo db"],
    "Redis": [],
    "SQL": [],
    "SQLAlchemy": ["sql alchemy"],
    "Docker": [],
    "Docker Compose": ["docker-compose"],
    "Kubernetes": ["k8s", "kube"],
    "AWS": ["amazon web services"],
    "GCP": ["google cloud", "google cloud platform"],
    "Azure": ["microsoft azure"],
    "Node.js": ["node", "nodejs", "node js"],
    "React": ["reactjs", "react.js", "react js"],
    "Next.js": ["next", "nextjs", "next js"],
    "Vue.js": ["vue", "vuejs", "vue js"],
    "Angular": [],
    "C++": ["cpp"],
    "C#": ["csharp", "c sharp"],
    "Go": ["golang", "go lang"],
    "Java": [],
    "Spring Boot": ["springboot", "spring-boot"],
    "REST API": ["rest", "restful", "rest apis", "restful api", "restful apis"],
    "GraphQL": ["graph ql"],
    "CI/CD": ["cicd", "ci cd", "ci-cd"],
    "Git": [],
    "GitHub": ["git hub"],
    "Linux": [],
    "HTML": ["html5"],
    "CSS": ["css3"],
    "Tailwind CSS": ["tailwind", "tailwindcss"],
    "Machine Learning": ["ml"],
    "Natural Language Processing": ["nlp"],
    "Artificial Intelligence": ["ai"],
    "Scikit-learn": ["sklearn", "scikit learn"],
    "TensorFlow": [],
    "PyTorch": [],
    "NumPy": [],
    "Pandas": [],
    "Elasticsearch": ["elastic search"],
    "RabbitMQ": ["rabbit mq"],
    "Kafka": ["apache kafka"],
    "Celery": [],
    "Microservices": ["microservice", "micro services"],
    "Terraform": [],
}


def _key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


_LOOKUP: dict[str, str] = {}
for _canonical, _aliases in _CANONICAL.items():
    for _name in (_canonical, *_aliases):
        _LOOKUP[_key(_name)] = _canonical

_VERSION_SUFFIX = re.compile(r"[\s\-]*v?\d+(?:\.\d+)*$")


def normalize_skill(raw: str) -> str:
    """Return the canonical skill name, or the cleaned original if the skill is unknown."""
    cleaned = re.sub(r"\s+", " ", raw.strip(" \t\n,;:•·*|"))
    key = _key(cleaned)
    if key in _LOOKUP:
        return _LOOKUP[key]
    unversioned = _VERSION_SUFFIX.sub("", key)  # "Python 3.11" -> "python"
    if unversioned and unversioned in _LOOKUP:
        return _LOOKUP[unversioned]
    return cleaned



def surface_forms(skill: str) -> list[str]:
    """All lowercase spellings that mean the same skill (canonical name + aliases)."""
    canonical = normalize_skill(skill)
    forms = [canonical.lower()] + [k for k, v in _LOOKUP.items() if v == canonical]
    return list(dict.fromkeys(forms))