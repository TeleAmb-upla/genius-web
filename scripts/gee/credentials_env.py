"""
Configura la variable de entorno que usa la API de Earth Engine y Drive.

La librería `earthengine-api` lee ``EARTHENGINE_CREDENTIALS`` (ruta a un JSON OAuth)
al inicializar. Tras ``earthengine authenticate``, ese archivo suele estar en
``%USERPROFILE%\\.config\\earthengine\\credentials`` (Windows) o ``~/.config/earthengine/credentials``.

Para no depender de esa ruta en cada máquina, puedes copiar ese JSON a
``secrets/earthengine_credentials.json`` en la raíz del repo (no se sube a git).

Orden de prioridad:
1. ``EARTHENGINE_CREDENTIALS`` ya definida en el entorno → no se cambia.
2. ``EE_CREDENTIALS_FILE`` → ruta absoluta o relativa al repo al JSON OAuth.
3. ``secrets/earthengine_credentials.json`` si el archivo existe.

Llamar ``ensure_earthengine_credentials_env()`` **antes** de ``import ee``.
"""
from __future__ import annotations

import os
from pathlib import Path

from .config import paths


def ensure_earthengine_credentials_env() -> None:
    if (os.environ.get("EARTHENGINE_CREDENTIALS") or "").strip():
        return

    custom = (os.environ.get("EE_CREDENTIALS_FILE") or "").strip()
    if custom:
        p = Path(custom).expanduser()
        if not p.is_absolute():
            p = (paths.PROJECT_ROOT / p).resolve()
        else:
            p = p.resolve()
    else:
        p = paths.EE_OAUTH_CREDENTIALS_FILE

    if p.is_file():
        os.environ["EARTHENGINE_CREDENTIALS"] = str(p)
