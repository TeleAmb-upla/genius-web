"""
Descarga archivos exportados por Earth Engine desde Google Drive hacia el repositorio local.

Usa las mismas credenciales que `earthengine authenticate` (~/.config/earthengine/credentials)
y la API de Drive (solo lectura). Las carpetas deben coincidir con `scripts.gee.paths` (DRIVE_*).

Por cada clave de sincronización, la **primera** vez se hace espejo completo: se eliminan en
local los archivos con las extensiones gestionadas y se descarga todo lo que haya en la carpeta
de Drive. A partir de entonces solo se descargan archivos que aún no existan en el repo
(estado en `drive_sync_keys_state.json` junto a este script).

Uso (desde la raíz del repositorio):

    python -m scripts.gee.download_drive_to_repo
    python -m scripts.gee.download_drive_to_repo --dry-run
    python -m scripts.gee.download_drive_to_repo --only raster_monthly,csv
    python -m scripts.gee.download_drive_to_repo --full-sync
    python -m scripts.gee.download_drive_to_repo --incremental-only
    python scripts/gee/download_drive_to_repo.py

Requisitos: haber ejecutado `earthengine authenticate` (incluye alcance de Drive).
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
from pathlib import Path
from typing import Iterable

# Ejecutar como archivo: habilitar imports relativos (igual que export_all.py).
if __name__ == "__main__" and not __package__:
    _repo = Path(__file__).resolve().parents[2]
    _repo_str = str(_repo)
    if _repo_str not in sys.path:
        sys.path.insert(0, _repo_str)
    __package__ = "scripts.gee"

from . import paths


STATE_FILENAME = "drive_sync_keys_state.json"


def _drive_sync_state_path() -> Path:
    return Path(__file__).resolve().parent / STATE_FILENAME


def _load_key_modes() -> dict[str, str]:
    p = _drive_sync_state_path()
    if not p.is_file():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        raw = data.get("keys")
        if not isinstance(raw, dict):
            return {}
        return {str(k): str(v) for k, v in raw.items()}
    except (json.JSONDecodeError, OSError, TypeError, ValueError):
        return {}


def _save_key_modes(modes: dict[str, str]) -> None:
    p = _drive_sync_state_path()
    p.write_text(json.dumps({"keys": modes}, indent=2), encoding="utf-8")


def _ee_credential_paths() -> list[Path]:
    out = [Path.home() / ".config" / "earthengine" / "credentials"]
    extra = os.environ.get("EARTHENGINE_CREDENTIALS", "").strip()
    if extra:
        out.append(Path(extra))
    return out


def _load_drive_credentials():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    scope = ["https://www.googleapis.com/auth/drive.readonly"]
    cred_path = next((p for p in _ee_credential_paths() if p.is_file()), None)
    if cred_path is None:
        raise FileNotFoundError(
            "No se encontró credentials de Earth Engine. Ejecute: earthengine authenticate\n"
            f"Buscado en: {_ee_credential_paths()[0]}"
        )

    data = json.loads(cred_path.read_text(encoding="utf-8"))
    creds = Credentials.from_authorized_user_info(data, scope)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    if not creds.valid:
        raise RuntimeError(
            "Credenciales no válidas. Vuelva a ejecutar: earthengine authenticate"
        )
    return creds


def _drive_service():
    from googleapiclient.discovery import build

    return build("drive", "v3", credentials=_load_drive_credentials(), cache_discovery=False)


def get_drive_service():
    """Cliente de la API de Google Drive v3 (mismas credenciales que `earthengine authenticate`)."""
    return _drive_service()


def _find_folder_id(service, name: str) -> str:
    from googleapiclient.errors import HttpError

    safe = name.replace("'", "\\'")
    q = (
        f"name = '{safe}' and mimeType = 'application/vnd.google-apps.folder' "
        "and trashed = false"
    )
    try:
        res = (
            service.files()
            .list(q=q, spaces="drive", fields="files(id,name)", pageSize=10)
            .execute()
        )
    except HttpError as e:
        raise RuntimeError(f"Drive API error al buscar carpeta '{name}': {e}") from e
    files = res.get("files", [])
    if not files:
        raise FileNotFoundError(
            f"No hay carpeta en Drive llamada exactamente '{name}'. "
            "Cree la carpeta o espere a que una exportación EE la genere."
        )
    if len(files) > 1:
        print(
            f"Aviso: varias carpetas '{name}'; usando la primera (id={files[0]['id']}).",
            file=sys.stderr,
        )
    return files[0]["id"]


def _list_files(service, folder_id: str) -> list[dict]:
    out: list[dict] = []
    page_token = None
    q = f"'{folder_id}' in parents and trashed = false"
    while True:
        res = (
            service.files()
            .list(
                q=q,
                spaces="drive",
                fields="nextPageToken, files(id, name, mimeType, size)",
                pageToken=page_token,
                pageSize=100,
            )
            .execute()
        )
        out.extend(res.get("files", []))
        page_token = res.get("nextPageToken")
        if not page_token:
            break
    return out


def _download_binary(service, file_id: str, dest: Path) -> None:
    from googleapiclient.http import MediaIoBaseDownload

    dest.parent.mkdir(parents=True, exist_ok=True)
    request = service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    dest.write_bytes(buf.getvalue())


def _normalize_exts(extensions: Iterable[str]) -> tuple[str, ...]:
    return tuple(e.lower() if e.startswith(".") else f".{e.lower()}" for e in extensions)


def _filter_drive_files(files: list[dict], exts: tuple[str, ...]) -> list[dict]:
    out: list[dict] = []
    for f in files:
        name = f.get("name") or ""
        mime = f.get("mimeType") or ""
        if mime.startswith("application/vnd.google-apps."):
            continue
        if any(name.lower().endswith(ext) for ext in exts):
            out.append(f)
    return out


def _sync_folder(
    service,
    drive_folder_name: str,
    dest_dir: Path,
    extensions: Iterable[str],
    *,
    dry_run: bool,
    full_replace: bool,
) -> int:
    """
    Sincroniza una carpeta de Drive hacia dest_dir.

    full_replace True: borra en local los archivos con extensiones gestionadas y descarga
    todo lo que haya en Drive (espejo). full_replace False: solo descarga si el archivo
    no existe en dest_dir.
    """
    fid = _find_folder_id(service, drive_folder_name)
    files = _list_files(service, fid)
    exts = _normalize_exts(extensions)
    candidates = _filter_drive_files(files, exts)
    print(
        f"  Disponible en Drive '{drive_folder_name}': "
        f"{len(candidates)} archivo(s) ({', '.join(exts)})"
    )

    dest_dir.mkdir(parents=True, exist_ok=True)

    deleted = 0
    if full_replace and dest_dir.is_dir():
        for p in dest_dir.iterdir():
            if not p.is_file():
                continue
            if p.suffix.lower() not in exts:
                continue
            if dry_run:
                print(f"  [dry-run] eliminar local {p.name}")
            else:
                p.unlink()
            deleted += 1
        if deleted and not dry_run:
            print(f"  Eliminados {deleted} archivo(s) locales (espejo completo).")
        elif deleted and dry_run:
            print(f"  [dry-run] se eliminarían {deleted} archivo(s) locales.")

    n_down = 0
    for f in candidates:
        name = f.get("name") or ""
        dest = dest_dir / name
        if not full_replace and dest.is_file():
            continue
        if dry_run:
            print(f"  [dry-run] {drive_folder_name}/{name} -> {dest}")
        else:
            print(f"  descargando {name} -> {dest}")
            _download_binary(service, f["id"], dest)
        n_down += 1

    if not full_replace and len(candidates) > n_down:
        skipped = len(candidates) - n_down
        print(f"  Omitidos {skipped} archivo(s) (ya existen en local; modo incremental).")

    mode = "espejo completo" if full_replace else "incremental"
    print(f"  Descargas en esta pasada ({mode}): {n_down}")
    return n_down


def _ndvi_csv_drive_folder_names() -> list[str]:
    """Carpetas Drive únicas (orden: mensual, anual); pueden ser el mismo nombre."""
    out: list[str] = []
    for n in (paths.DRIVE_CSV_MONTHLY, paths.DRIVE_CSV_YEARLY):
        if n not in out:
            out.append(n)
    return out


def _sync_ndvi_csv_bundle(
    service,
    dest_dir: Path,
    extensions: Iterable[str],
    *,
    dry_run: bool,
    full_replace: bool,
) -> int:
    """
    Une DRIVE_CSV_MONTHLY y DRIVE_CSV_YEARLY hacia REPO_CSV.

    REPO_CSV contiene otros CSV del proyecto: en espejo completo solo se eliminan
    locales cuyo nombre aparece en alguna de las carpetas NDVI de Drive (no todos los .csv).
    """
    exts = _normalize_exts(extensions)
    merged: dict[str, dict] = {}
    folder_summaries: list[tuple[str, int]] = []

    for drive_folder_name in _ndvi_csv_drive_folder_names():
        try:
            fid = _find_folder_id(service, drive_folder_name)
        except FileNotFoundError:
            print(f"  omitido carpeta '{drive_folder_name}': no existe en Drive", file=sys.stderr)
            continue
        files = _list_files(service, fid)
        candidates = _filter_drive_files(files, exts)
        folder_summaries.append((drive_folder_name, len(candidates)))
        for f in candidates:
            name = f.get("name") or ""
            if name:
                merged[name] = f

    for folder_nm, count in folder_summaries:
        print(
            f"  Disponible en Drive '{folder_nm}': {count} archivo(s) ({', '.join(exts)})"
        )

    if not merged:
        print("  Sin archivos CSV NDVI en las carpetas configuradas.")
        return 0

    dest_dir.mkdir(parents=True, exist_ok=True)
    managed_names = frozenset(merged.keys())

    deleted = 0
    if full_replace and dest_dir.is_dir():
        for name in sorted(managed_names):
            p = dest_dir / name
            if not p.is_file():
                continue
            if dry_run:
                print(f"  [dry-run] eliminar local (NDVI Drive) {name}")
            else:
                p.unlink()
            deleted += 1
        if deleted and not dry_run:
            print(f"  Eliminados {deleted} archivo(s) locales previos (solo nombres en Drive NDVI).")
        elif deleted and dry_run:
            print(f"  [dry-run] se eliminarían {deleted} archivo(s) locales (solo nombres en Drive NDVI).")

    n_down = 0
    for name in sorted(merged.keys()):
        f = merged[name]
        dest = dest_dir / name
        if not full_replace and dest.is_file():
            continue
        if dry_run:
            print(f"  [dry-run] {name} -> {dest}")
        else:
            print(f"  descargando {name} -> {dest}")
            _download_binary(service, f["id"], dest)
        n_down += 1

    if not full_replace and len(merged) > n_down:
        print(
            f"  Omitidos {len(merged) - n_down} archivo(s) (ya existen en local; modo incremental)."
        )

    mode = "espejo completo" if full_replace else "incremental"
    print(f"  Descargas en esta pasada ({mode}, NDVI CSV): {n_down}")
    return n_down


# Clave -> (carpeta Drive, ruta local, extensiones)
SYNC_REGISTRY: dict[str, tuple[str, Path, tuple[str, ...]]] = {
    "raster_monthly": (
        paths.DRIVE_RASTER_MONTHLY,
        paths.REPO_RASTER_NDVI_MONTHLY,
        (".tif", ".tiff"),
    ),
    "raster_yearly": (
        paths.DRIVE_RASTER_YEARLY,
        paths.REPO_RASTER_NDVI_YEARLY,
        (".tif", ".tiff"),
    ),
    "raster_trend": (
        paths.DRIVE_RASTER_TREND,
        paths.REPO_RASTER_NDVI_TREND,
        (".tif", ".tiff"),
    ),
    "raster_sd": (
        paths.DRIVE_RASTER_SD,
        paths.REPO_RASTER_NDVI_SD,
        (".tif", ".tiff"),
    ),
    # El primer campo no se usa; la sync real pasa por _sync_ndvi_csv_bundle (monthly+yearly).
    "csv": (paths.DRIVE_CSV_MONTHLY, paths.REPO_CSV, (".csv",)),
    "csv_yearmonth": (
        paths.DRIVE_CSV_YEARMONTH,
        paths.REPO_NDVI_YEARMONTH_CSV,
        (".csv",),
    ),
    "geo_monthly_b": (
        paths.DRIVE_GEO_MONTHLY_B,
        paths.REPO_GEOJSON_NDVI_MONTHLY_B,
        (".geojson", ".json"),
    ),
    "geo_monthly_m": (
        paths.DRIVE_GEO_MONTHLY_M,
        paths.REPO_GEOJSON_NDVI_MONTHLY_M,
        (".geojson", ".json"),
    ),
    "geo_yearly_b": (
        paths.DRIVE_GEO_YEARLY_B,
        paths.REPO_GEOJSON_NDVI_YEARLY_B,
        (".geojson", ".json"),
    ),
    "geo_yearly_m": (
        paths.DRIVE_GEO_YEARLY_M,
        paths.REPO_GEOJSON_NDVI_YEARLY_M,
        (".geojson", ".json"),
    ),
    "geo_sd_av": (
        paths.DRIVE_GEO_SD_AV,
        paths.REPO_GEOJSON_NDVI_SD,
        (".geojson", ".json"),
    ),
    "geo_trend_b": (
        paths.DRIVE_GEO_TREND_B,
        paths.REPO_GEOJSON_NDVI_TREND_B,
        (".geojson", ".json"),
    ),
    "geo_trend_m": (
        paths.DRIVE_GEO_TREND_M,
        paths.REPO_GEOJSON_NDVI_TREND_M,
        (".geojson", ".json"),
    ),
}


def parse_sync_keys(only_raw: str) -> list[str]:
    """Resuelve la cadena --only (o 'all') a claves válidas de SYNC_REGISTRY."""
    s = only_raw.strip().lower()
    if s == "all":
        return list(SYNC_REGISTRY.keys())
    keys = [k.strip().lower() for k in only_raw.split(",") if k.strip()]
    bad = set(keys) - set(SYNC_REGISTRY)
    if bad:
        raise ValueError(f"Claves no válidas: {bad}. Válidas: {sorted(SYNC_REGISTRY)}")
    return keys


def run_drive_sync(
    keys: list[str],
    *,
    dry_run: bool = False,
    full_replace: bool | None = None,
) -> int:
    """
    Descarga las carpetas indicadas desde Drive hacia REPO_*.

    Args:
        keys: Claves de SYNC_REGISTRY.
        dry_run: Si True, no escribe ni elimina archivos.
        full_replace: None = primera vez por clave es espejo completo, luego incremental;
            True = forzar espejo completo para todas las claves; False = solo incremental.

    Returns:
        Suma de archivos descargados (o contados en dry-run) en todas las claves.
    """
    print("Conectando a Google Drive…")
    service = _drive_service()
    modes = _load_key_modes()
    total = 0

    for key in keys:
        drive_name, dest, exts = SYNC_REGISTRY[key]
        if full_replace is None:
            use_full = modes.get(key) != "incremental"
        else:
            use_full = full_replace

        if key == "csv":
            folders = ", ".join(_ndvi_csv_drive_folder_names())
            print(f"Sincronizando [csv] Drive: {folders} -> {dest}")
        else:
            print(f"Sincronizando [{key}] {drive_name} -> {dest}")
        print(f"  Modo: {'espejo completo (reemplaza gestionados en local)' if use_full else 'incremental (solo faltantes)'}")
        try:
            if key == "csv":
                total += _sync_ndvi_csv_bundle(
                    service,
                    dest,
                    exts,
                    dry_run=dry_run,
                    full_replace=use_full,
                )
            else:
                total += _sync_folder(
                    service,
                    drive_name,
                    dest,
                    exts,
                    dry_run=dry_run,
                    full_replace=use_full,
                )
            if not dry_run:
                modes[key] = "incremental"
                _save_key_modes(modes)
        except FileNotFoundError as e:
            print(f"  omitido: {e}", file=sys.stderr)

    print(f"Listo. Archivos descargados (esta corrida): {total}" + (" (dry-run)" if dry_run else ""))
    if not dry_run and full_replace is None:
        print(f"Estado de modo por clave guardado en: {_drive_sync_state_path()}")
    return total


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Descargar exportaciones NDVI de Google Drive al repo local."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo muestra qué se haría, sin borrar ni descargar.",
    )
    parser.add_argument(
        "--full-sync",
        action="store_true",
        help="Forzar espejo completo en todas las claves seleccionadas (reemplaza locales).",
    )
    parser.add_argument(
        "--incremental-only",
        action="store_true",
        help="Solo descargar archivos que no existan en local (nunca borrar locales).",
    )
    parser.add_argument(
        "--only",
        default="all",
        help=(
            "Subconjunto separado por comas (claves). Claves: "
            + ", ".join(sorted(SYNC_REGISTRY))
            + " o all."
        ),
    )
    args = parser.parse_args(argv)

    if args.full_sync and args.incremental_only:
        print("Use solo uno de --full-sync o --incremental-only.", file=sys.stderr)
        sys.exit(2)

    fr: bool | None
    if args.full_sync:
        fr = True
    elif args.incremental_only:
        fr = False
    else:
        fr = None

    try:
        keys = parse_sync_keys(args.only)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)

    run_drive_sync(keys, dry_run=args.dry_run, full_replace=fr)


if __name__ == "__main__":
    main()
