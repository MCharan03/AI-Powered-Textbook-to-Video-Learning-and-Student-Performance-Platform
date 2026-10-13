from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "AI-Powered Textbook-to-Video Platform"
    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = "sqlite:///./app.db"
    max_upload_mb: int = 50

settings = Settings()
