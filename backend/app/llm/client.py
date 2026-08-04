"""LLM client factory.

Single Responsibility: decide whether a real LLM is available and construct
it. Everything else (nodes, runner) depends only on `get_llm()` returning
`None` or a LangChain chat model — they never read Settings directly. This
is the Dependency Inversion seam that lets the whole graph run with zero
OpenAI configuration (the ACU-68 priority: simulated fallback is first-class,
not an afterthought).
"""

from langchain_openai import ChatOpenAI

from app.config import get_settings


def get_llm() -> ChatOpenAI | None:
    """Returns a configured ChatOpenAI instance, or None if no API key is set.

    Callers MUST treat `None` as "use the simulated fallback" — never raise
    for a missing key, since simulated-mode is a supported first-class path.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.4,
    )


def is_llm_available() -> bool:
    """Cheap check for /healthz — avoids constructing a client just to report status."""
    return bool(get_settings().openai_api_key)
