"""Local file storage for transaction attachments."""

import uuid
from pathlib import Path


# Safe extension mapping; default to .bin for unknown
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".pdf", ".heic",
}
MAX_FILENAME_LEN = 200


def _safe_extension(filename: str) -> str:
    """Return a safe extension from filename, or .bin if unknown."""
    p = Path(filename)
    ext = (p.suffix or "").lower()
    if ext and ext in ALLOWED_EXTENSIONS:
        return ext
    return ".bin"


def save_transaction_attachment(
    transaction_id: str,
    file_content: bytes,
    filename: str,
    upload_dir: str,
) -> str:
    """
    Save file to disk under {upload_dir}/transactions/{transaction_id}/{uuid}.{ext}.
    Create parent dirs as needed. Return relative path for DB (file_path).
    """
    base = Path(upload_dir) / "transactions" / transaction_id
    base.mkdir(parents=True, exist_ok=True)
    ext = _safe_extension(filename)
    name = f"{uuid.uuid4().hex}{ext}"
    path = base / name
    path.write_bytes(file_content)
    # Return path relative to upload_dir so it's portable
    rel = path.relative_to(Path(upload_dir))
    return str(rel).replace("\\", "/")
