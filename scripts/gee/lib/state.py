"""Lectura/escritura de estado JSON por producto (incremental)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def read_state(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return {}


def merge_state(path: Path, updates: dict[str, Any]) -> None:
    data = read_state(path)
    data.update(updates)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
