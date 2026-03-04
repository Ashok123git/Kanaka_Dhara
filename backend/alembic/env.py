"""Alembic env: async engine; URL and metadata from app (settings + Base)."""
import asyncio
import sys
from pathlib import Path

# Add backend root so "app" and "db" resolve
_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.config import settings
from db.base import Base

# Import all models so Base.metadata is complete for autogenerate
import db.models  # noqa: F401

config = context.config
target_metadata = Base.metadata

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use DATABASE_URL from app settings (async URL)
url = settings.DATABASE_URL
# Escape % for ConfigParser (e.g. %40 in passwords)
config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
