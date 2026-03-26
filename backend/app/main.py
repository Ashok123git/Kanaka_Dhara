import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings

# Ensure OTP and SMS log messages are visible when running uvicorn
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logging.getLogger("api.v1.auth").setLevel(logging.INFO)
logging.getLogger("services.sms").setLevel(logging.INFO)
logger = logging.getLogger(__name__)
from api.v1.router import api_v1_router
from db.base import Base
from db.session import engine
from db.models import (  # noqa: F401 - register with Base.metadata
    Contact,
    Order,
    OtpVerification,
    RefreshToken,
    Transaction,
    TransactionAttachment,
    User,
    Wholesaler,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Ensure upload directory exists for transaction attachments
        Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

        # Create tables if they do not exist (dev convenience; disable in production)
        if settings.AUTO_CREATE_DB_SCHEMA:
            logger.info("AUTO_CREATE_DB_SCHEMA enabled; creating DB tables if missing")
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        else:
            logger.info("AUTO_CREATE_DB_SCHEMA disabled; skipping Base.metadata.create_all()")
    except Exception:
        # This makes Render show a clear reason in logs instead of just "Exited with status 1"
        logger.exception("Application startup failed during lifespan initialization")
        raise
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Kanaka Dhara API", version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_v1_router, prefix="/api/v1")

    # Serve uploaded transaction attachment files
    upload_dir = Path(settings.UPLOAD_DIR).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/api/v1/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

    return app


app = create_app()

