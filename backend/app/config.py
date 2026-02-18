from pydantic_settings import BaseSettings
from typing import List, Tuple, Type


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # AI/ML
    ANTHROPIC_API_KEY: str = "your-api-key-here"

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = ""

    # Application
    APP_NAME: str = "CRE Platform"
    DEBUG: bool = False
    UPLOAD_DIR: str = "./uploads"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True
        env_file_encoding = "utf-8"
        extra = "ignore"

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: Type[BaseSettings],
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        """
        Override source priority so .env file wins over shell environment variables.
        Default order: init > env > dotenv > file_secret
        New order:     init > dotenv > env > file_secret
        This prevents stale exported shell vars from overriding .env values.
        """
        return (
            init_settings,
            dotenv_settings,      # .env file — highest priority after init
            env_settings,         # shell environment — fallback
            file_secret_settings,
        )


settings = Settings()
