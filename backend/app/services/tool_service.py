from datetime import datetime, timezone
from typing import Any


class ToolService:
    def openai_compatible_specs(self, names: list[str]) -> list[dict[str, Any]]:
        registry = {
            "current_time": {
                "type": "function",
                "function": {
                    "name": "current_time",
                    "description": "Return the current UTC timestamp.",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        }
        return [registry[name] for name in names if name in registry]

    def execute(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "current_time":
            return {"now": datetime.now(timezone.utc).isoformat()}
        return {"error": f"Unknown tool: {name}"}

