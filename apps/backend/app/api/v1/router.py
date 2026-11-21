"""Versioned v1 router reserved for Phase 2+ prediction endpoints."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["v1"])

