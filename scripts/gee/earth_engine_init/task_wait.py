"""Espera a que las tareas batch de Earth Engine (export a Drive) terminen."""
from __future__ import annotations

import sys
import time
from typing import Any, Sequence


def wait_for_tasks(
    tasks: Sequence[Any],
    *,
    poll_seconds: float = 30.0,
    timeout_seconds: float | None = None,
    stream: Any = sys.stdout,
    audit_prefix: str | None = None,
) -> None:
    """
    Bloquea hasta que ninguna tarea esté activa, luego comprueba estado final.

    Args:
        tasks: Instancias ``ee.batch.Task`` (solo las de exportación a Drive que
            deben completarse antes de sincronizar archivos).
        poll_seconds: Intervalo entre comprobaciones.
        timeout_seconds: Si se supera, lanza ``TimeoutError`` (None = sin límite).
        stream: destino para mensajes de progreso (ej. sys.stdout).
        audit_prefix: Prefijo opcional (p. ej. ``[NDVI]``) para trazar la variable en log.
    """
    pending = [t for t in tasks if t is not None]
    if not pending:
        return

    start = time.monotonic()
    n = len(pending)
    lead = f"{audit_prefix} " if audit_prefix else ""
    print(
        f"{lead}Esperando {n} tarea(s) de Earth Engine (export a Drive)…",
        file=stream,
    )
    while True:
        active = [t for t in pending if t.active()]
        if not active:
            break
        if timeout_seconds is not None and (time.monotonic() - start) > timeout_seconds:
            raise TimeoutError(
                f"Tiempo de espera agotado ({timeout_seconds}s) con "
                f"{len(active)} tarea(s) aún activas."
            )
        print(
            f"{lead}  … {len(active)}/{n} activas; reintento en {poll_seconds:.0f}s",
            file=stream,
        )
        time.sleep(poll_seconds)

    errors: list[str] = []
    for t in pending:
        st = t.status()
        state = (st or {}).get("state")
        if state != "COMPLETED":
            desc = (st or {}).get("description") or (st or {}).get("id") or repr(t)
            errors.append(f"{desc}: {state} — {st}")

    if errors:
        msg = "Una o más tareas de Earth Engine no completaron correctamente:\n" + "\n".join(
            f"  - {e}" for e in errors
        )
        if audit_prefix:
            msg = f"{audit_prefix}\n{msg}"
        raise RuntimeError(msg)

    print(
        f"{lead}Todas las tareas de export a Drive completaron (COMPLETED).",
        file=stream,
    )
