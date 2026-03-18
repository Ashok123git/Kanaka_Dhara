"""Tests for core.security token helpers."""

import pytest
from fastapi import HTTPException

from core import security


def test_decode_token_invalid_raises_401() -> None:
    with pytest.raises(HTTPException) as exc_info:
        security.decode_token("invalid-token")
    assert exc_info.value.status_code == 401
    assert "credentials" in str(exc_info.value.detail).lower()


def test_create_and_decode_access_token_with_wholesaler_id() -> None:
    subject = "user-123"
    wholesaler_id = "wh-456"
    token = security.create_access_token(subject=subject, wholesaler_id=wholesaler_id, expires_minutes=5)
    assert isinstance(token, str)

    payload = security.decode_token(token)
    assert payload["sub"] == subject
    assert payload["wholesaler_id"] == wholesaler_id
    assert "exp" in payload

