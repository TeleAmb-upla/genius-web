#!/usr/bin/env python3
"""
Comprueba que cada import de legend_ranges.js en assets/js resuelve a un fichero existente.
Evita 404 silenciosos que rompen todo el grafo de módulos (p. ej. ../../ mal contados).

Uso (desde la raíz del repo):
    python3 scripts/repo/legends/verify_legend_ranges_imports.py

Salida: 0 si todo OK; distinto de 0 si hay rutas rotas.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
JS_ROOT = REPO / "assets" / "js"
TARGET_NAME = "legend_ranges.js"

# import { x } from '...legend_ranges.js';
IMPORT_RE = re.compile(
    r"""from\s+['"](?P<spec>(?:\./|\.\./)+[^'"]*legend_ranges\.js)['"]\s*;""",
    re.MULTILINE,
)


def resolve_spec(from_file: Path, spec: str) -> Path:
    """spec es relativo al fichero que importa (p. ej. ../../../legend_ranges.js)."""
    base = from_file.parent
    # pathlib no resuelve .. en cadenas con normalización segura:
    return (base / spec).resolve()


def main() -> int:
    if not JS_ROOT.is_dir():
        print(f"No existe {JS_ROOT}", file=sys.stderr)
        return 2

    expected = (JS_ROOT / TARGET_NAME).resolve()
    errors: list[str] = []

    for path in sorted(JS_ROOT.rglob("*.js")):
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in IMPORT_RE.finditer(text):
            spec = m.group("spec")
            resolved = resolve_spec(path, spec)
            rel = path.relative_to(REPO)
            if not resolved.exists():
                errors.append(f"{rel}: import {spec!r} -> {resolved} (no existe)")
            elif resolved != expected:
                errors.append(
                    f"{rel}: import {spec!r} -> {resolved} "
                    f"(se esperaba {expected.relative_to(REPO)})"
                )

    if errors:
        print("Imports incorrectos de legend_ranges.js:\n", file=sys.stderr)
        for line in errors:
            print(f"  {line}", file=sys.stderr)
        print(
            "\nRevisa la profundidad de carpetas (cada nivel necesita un ../ extra). "
            "Si usas wire_legend_domains.py, corrige ahí y vuelve a cablear.",
            file=sys.stderr,
        )
        return 1

    print(f"OK: todos los imports de {TARGET_NAME} resuelven a {expected.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
