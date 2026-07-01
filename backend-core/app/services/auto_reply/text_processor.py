from typing import Any


class TextProcessor:
    def process_message_content(self, content: str | dict[str, Any] | None) -> dict[str, Any] | None:
        if isinstance(content, str):
            text = content.strip()
            return {"text": text} if text else None

        if isinstance(content, dict):
            if "text" in content:
                text = str(content.get("text", "")).strip()
                if text:
                    return content
                return None
            return content

        return None
