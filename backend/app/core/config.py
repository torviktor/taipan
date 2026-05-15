from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://taipan_user:taipan_pass@db:5432/taipan_db"
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_RANDOM_STRING"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 дней

    NEWS_QUALITY_CHECK_ENABLED: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
