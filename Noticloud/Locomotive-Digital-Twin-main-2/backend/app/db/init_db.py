import logging

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.services.profile_service import seed_profile_config

logger = logging.getLogger("app.db")


def init_db() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")

        db = SessionLocal()
        try:
            seed_profile_config(db)
            logger.info("Profile configuration seeded successfully")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Database initialization error: {e}")
        logger.warning("Continuing without database - using in-memory mode")