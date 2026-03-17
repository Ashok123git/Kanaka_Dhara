"""Tests for services.attachment_storage."""

from pathlib import Path

from services.attachment_storage import _safe_extension, save_transaction_attachment


def test_safe_extension() -> None:
    assert _safe_extension("x.pdf") == ".pdf"
    assert _safe_extension("x.JPG") == ".jpg"
    assert _safe_extension("noext") == ".bin"
    assert _safe_extension("x.unknown") == ".bin"


def test_save_transaction_attachment_returns_relative_path(tmp_path: Path) -> None:
    out = save_transaction_attachment(
        "tid-123", b"content", "file.pdf", str(tmp_path)
    )
    assert "transactions" in out
    assert "tid-123" in out
    assert ".pdf" in out
    assert (tmp_path / out).exists()
