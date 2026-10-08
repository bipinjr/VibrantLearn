"""Username rules (SECURITY.md §5). Mirrored in apps/web/lib/username.ts and the DB CHECK."""

import re

PATTERN = re.compile(r"^[A-Za-z0-9.|]{3,30}$")

RESERVED = frozenset(
    {
        "admin",
        "administrator",
        "support",
        "help",
        "vibrantlearn",
        "vibrant",
        "root",
        "system",
        "teacher",
        "teachers",
        "moderator",
        "mod",
        "staff",
        "official",
        "security",
        "api",
        "app",
        "null",
        "undefined",
        "me",
        "settings",
        "login",
        "signup",
        "auth",
        "onboarding",
    }
)


def problem(username: str) -> str | None:
    """None if valid, else a short human reason."""
    if not PATTERN.fullmatch(username):
        return "Use 3 to 30 letters, numbers, dots or | only."
    if username[0] in ".|" or username[-1] in ".|":
        return "Start and end with a letter or number."
    if ".." in username or "||" in username:
        return "No two dots or two | in a row."
    if username.lower().replace(".", "").replace("|", "") in RESERVED:
        return "That name is reserved. Try another."
    return None
