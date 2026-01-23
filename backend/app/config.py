"""Application configuration settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )

    # Application
    APP_NAME: str = "BudgetCSV"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite:///./budgetcsv.db"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://budget-app-git-main-thomas-projects-8638ab9e.vercel.app",
        "https://budgetapp-new.vercel.app",
    ]


settings = Settings()
