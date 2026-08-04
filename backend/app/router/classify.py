"""Prompt classification: does this operator request belong to life-support?

Only life-support is a "real" graph run in this vertical slice (per the
plan's decided scope) — everything else is `unsupported` and the frontend
keeps using its local scripted scenarios. Keyword matching is the default
(and only) path here since no LLM key implies no LLM classification either;
if a key is present we could upgrade to an LLM classifier later, but a
transparent keyword rule is easier to unit test and audit than a model call
for something this narrow.
"""

_LIFE_SUPPORT_KEYWORDS = (
    "oxygen",
    "o2",
    "life support",
    "life-support",
    "cabin pressure",
    "valve",
    "air pressure",
)


def classify_prompt(prompt: str) -> str:
    """Returns "life-support" or "unsupported"."""
    lowered = prompt.lower()
    if any(keyword in lowered for keyword in _LIFE_SUPPORT_KEYWORDS):
        return "life-support"
    return "unsupported"
