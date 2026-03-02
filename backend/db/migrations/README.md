# Database migrations

## Alembic (preferred for new schema changes)

Alembic is configured at the **backend root**: `alembic.ini` and the `alembic/` directory (including `alembic/env.py` and `alembic/versions/`). New schema changes should be done via Alembic:

- Run from backend root: `alembic revision --autogenerate -m "description"`, then `alembic upgrade head`.
- `env.py` uses `app.config.settings.DATABASE_URL` and `db.base.Base.metadata` (with all models loaded).

## Existing SQL migrations (reference only)

The SQL files in this directory (`versions/001_otp_and_users.sql`, `versions/002_architecture_schema.sql`) were used to create the initial schema. They remain for reference and history; **Alembic is now the preferred way** for any new schema changes.
