"""Alembic environment configuration for running migrations."""

import sys
import os
from pathlib import Path
from logging.config import fileConfig

from alembic import context

# Ensure the backend/ directory is on sys.path so `app` is importable
# regardless of where alembic is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Import our models so Alembic can detect them. We also reuse the already-
# configured SQLAlchemy engine — it has the Turso `auth_token` set in
# connect_args, which engine_from_config() below would otherwise drop and
# cause a server-side `Unauthorized: empty JWT token` error.
from app.models.db import Base, engine as app_engine
from app.core.config import DATABASE_URL

# Alembic Config object
config = context.config

# Override sqlalchemy.url from our config
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Set up logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# MetaData for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using the app's engine, which carries
    Turso's auth_token in connect_args."""
    with app_engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
