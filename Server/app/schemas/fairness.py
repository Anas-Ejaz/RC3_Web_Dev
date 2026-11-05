"""Fairness test schemas (contract: POST /fairness/test)."""
from typing import Literal

from pydantic import BaseModel, Field

Attribute = Literal["name", "gender", "age", "location", "nationality"]


class FairnessIn(BaseModel):
    application_id: int
    attributes: list[Attribute] = Field(default_factory=lambda: ["name", "gender", "age", "location"], min_length=1, max_length=5)


class VariantOut(BaseModel):
    attribute: str
    changed_to: str
    score: float
    delta: float


class FairnessOut(BaseModel):
    original_score: float
    variants: list[VariantOut]
    passed: bool
    max_abs_delta: float  # extra (not in contract)
    tolerance: float  # extra (not in contract)