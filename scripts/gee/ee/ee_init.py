"""
Inicialización de Google Earth Engine para los scripts en `scripts.gee`.

Tras `earthengine authenticate`, llama a `initialize_ee()` antes de usar `ee`.
Usa siempre `ee.Initialize(project=...)` con el id definido en `config.paths.EE_CLOUD_PROJECT`
(por defecto `ee-plataformagenius`), requisito de la API reciente.
"""
from __future__ import annotations

import sys
from typing import Any

from ..config.paths import EE_CLOUD_PROJECT
from ..credentials_env import ensure_earthengine_credentials_env

_initialized = False


def _default_project() -> str:
    p = (EE_CLOUD_PROJECT or "").strip()
    return p if p else "ee-plataformagenius"


def initialize_ee(**kwargs: Any) -> None:
    """
    Ejecuta ee.Initialize(project=...) con el proyecto Plataforma GENIUS por defecto.

    Puede pasar otros argumentos admitidos por ee.Initialize; `project` en kwargs
    sobrescribe el valor por defecto.
    """
    global _initialized
    if _initialized:
        return

    ensure_earthengine_credentials_env()

    # Importar e explícitamente evitando conflicto con carpeta local ee/
    import importlib
    ee = importlib.import_module("ee")

    init_kw: dict[str, Any] = {"project": _default_project()}
    init_kw.update(kwargs)

    try:
        ee.Initialize(**init_kw)
    except Exception as e:
        print(
            "Error al inicializar Earth Engine. Revise la autenticación: "
            "ejecute `earthengine authenticate` en la misma cuenta y entorno Python.",
            file=sys.stderr,
        )
        print(e, file=sys.stderr)
        raise SystemExit(1) from e

    print(f"Conexión exitosa con Google Earth Engine (proyecto: {init_kw['project']})")
    _initialized = True
    _initialized = True
