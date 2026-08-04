"""Application settings, loaded from environment / .env (pydantic-settings).

Single Responsibility: this module ONLY resolves configuration values. It
never decides behavior (e.g. whether to use the real LLM) — callers read
`settings.openai_api_key` and make that call themselves (see llm/client.py).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    frontend_origin: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — avoids re-parsing the environment on every request."""
    return Settings()
