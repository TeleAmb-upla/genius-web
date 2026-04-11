"""
Descarga archivos exportados por Earth Engine desde Google Drive hacia el repositorio local.

Usa las mismas credenciales que `earthengine authenticate` (~/.config/earthengine/credentials)
y la API de Drive. El alcance OAuth debe coincidir con el del cliente EE (auth/drive, no
drive.readonly: el refresh falla con restricted_client si se pide un alcance no registrado).
Cuando se re-exporta un producto (tendencia, climatología mensual, etc.), se eliminan
los archivos antiguos en Drive antes de encolar la nueva exportación, evitando duplicados.

Carpetas raster NDVI en Drive (alineadas a ``scripts/gee/paths.py``): ``NDVI_Monthly``,
``NDVI_Yearly`` (solo anuales), ``NDVI_Trend`` (solo tendencia), ``NDVI_StdDev``.

Por cada clave de sincronización, la **primera** vez se hace espejo completo: se eliminan en
local los archivos con las extensiones gestionadas y se descarga todo lo que haya en la carpeta
de Drive. A partir de entonces solo se descargan archivos que aún no existan en el repo
(estado en `drive_sync_keys_state.json` junto a este script).

Uso (desde la raíz del repositorio):

    python -m scripts.gee.drive.download_drive_to_repo
    python -m scripts.gee.drive.download_drive_to_repo --dry-run
    python -m scripts.gee.drive.download_drive_to_repo --only raster_monthly,csv
    python -m scripts.gee.drive.download_drive_to_repo --full-sync
    python -m scripts.gee.drive.download_drive_to_repo --incremental-only
    python scripts/gee/download_drive_to_repo.py

Requisitos: haber ejecutado `earthengine authenticate` (incluye alcance de Drive).
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

# Ejecutar como archivo: habilitar imports relativos (igual que export_all.py).
if __name__ == "__main__" and not __package__:
    _repo = Path(__file__).resolve().parents[2]
    _repo_str = str(_repo)
    if _repo_str not in sys.path:
        sys.path.insert(0, _repo_str)
    __package__ = "scripts.gee.drive"

from ..config import paths
from ..credentials_env import ensure_earthengine_credentials_env
from ..audit_terminal import print_audit_block, sync_key_human_summary


STATE_FILENAME = "drive_sync_keys_state.json"


@dataclass(frozen=True)
class DriveSyncSpec:
    """Carpeta Drive → destino local, con filtro opcional por prefijo de nombre de archivo."""

    drive_folder: str
    dest_dir: Path
    extensions: tuple[str, ...]
    stem_prefixes: tuple[str, ...] | None = None
    stem_exclude_substrings: tuple[str, ...] = ()


def _file_matches_sync_spec(filename: str, spec: DriveSyncSpec) -> bool:
    if spec.stem_prefixes:
        if not any(filename.startswith(p) for p in spec.stem_prefixes):
            return False
    lower = filename.lower()
    for sub in spec.stem_exclude_substrings:
        if sub.lower() in lower:
            return False
    return True


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
    ensure_earthengine_credentials_env()
    extra = os.environ.get("EARTHENGINE_CREDENTIALS", "").strip()
    if extra:
        return [Path(extra)]
    return [Path.home() / ".config" / "earthengine" / "credentials"]


def _load_drive_credentials():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    # Mismo alcance que `ee.oauth.SCOPES` (auth/drive). drive.readonly provoca RefreshError
    # restricted_client con el OAuth client de Earth Engine al refrescar el token.
    scope = ["https://www.googleapis.com/auth/drive"]
    cred_path = next((p for p in _ee_credential_paths() if p.is_file()), None)
    if cred_path is None:
        raise FileNotFoundError(
            "No se encontró credentials de Earth Engine. Ejecute: earthengine authenticate\n"
            f"Buscado en: {_ee_credential_paths()[0]}"
        )

    data = json.loads(cred_path.read_text(encoding="utf-8"))
    # El JSON de `earthengine authenticate` a veces no incluye client_id/client_secret;
    # google.oauth2.credentials lo exige para refrescar. Mismos defaults que `ee.oauth`.
    if not data.get("client_id") or not data.get("client_secret"):
        try:
            from ee import oauth as ee_oauth
        except ImportError as e:
            raise RuntimeError(
                "En credentials faltan client_id/client_secret. "
                "Instale earthengine-api o vuelva a ejecutar: earthengine authenticate"
            ) from e
        if not data.get("client_id"):
            data["client_id"] = ee_oauth.CLIENT_ID
        if not data.get("client_secret"):
            data["client_secret"] = ee_oauth.CLIENT_SECRET
        if not data.get("token_uri"):
            data["token_uri"] = ee_oauth.TOKEN_URI

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
                fields="nextPageToken, files(id, name, mimeType, size, modifiedTime)",
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


def _trash_drive_file(service, file_id: str, name: str = "") -> bool:
    """Move a Drive file to trash. Returns True on success."""
    try:
        service.files().update(fileId=file_id, body={"trashed": True}).execute()
        label = f" ({name})" if name else ""
        print(f"  [Drive] eliminado{label}")
        return True
    except Exception as e:
        print(f"  [Drive] error al eliminar {name or file_id}: {e}", file=sys.stderr)
        return False


def clear_drive_folder_files(
    service,
    folder_name: str,
    *,
    extensions: tuple[str, ...] = (".tif", ".tiff"),
    stem_prefixes: tuple[str, ...] | None = None,
    file_stems: tuple[str, ...] | None = None,
    stem_exclude_substrings: tuple[str, ...] = (),
    dry_run: bool = False,
    reason: str = "",
) -> int:
    """Trash all matching files in a Drive folder. Returns count of trashed files."""
    exts = _normalize_exts(extensions)
    try:
        fid = _find_folder_id(service, folder_name)
    except FileNotFoundError:
        return 0
    files = _list_files(service, fid)
    candidates = _filter_drive_files(files, exts)

    matched: list[dict] = []
    wanted_lower = {s.lower() for s in file_stems or ()}
    for f in candidates:
        n = f.get("name") or ""
        stem_lower = Path(n).stem.lower()
        if wanted_lower and stem_lower not in wanted_lower:
            continue
        if stem_prefixes and not any(n.startswith(p) for p in stem_prefixes):
            continue
        nl = n.lower()
        if any(sub.lower() in nl for sub in stem_exclude_substrings):
            continue
        matched.append(f)

    if not matched:
        return 0

    trashed = 0
    for f in matched:
        n = f.get("name") or ""
        if dry_run:
            print(f"  [dry-run] eliminaría en Drive '{folder_name}': {n}")
            trashed += 1
        else:
            if _trash_drive_file(service, f["id"], n):
                trashed += 1
    if trashed:
        mode = " (dry-run)" if dry_run else ""
        why = f" ({reason})" if reason else ""
        print(f"  [Drive] Eliminados {trashed} archivo(s) de '{folder_name}'{why}{mode}")
    return trashed


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
    spec: DriveSyncSpec,
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
    drive_folder_name = spec.drive_folder
    dest_dir = spec.dest_dir
    exts = _normalize_exts(spec.extensions)
    fid = _find_folder_id(service, drive_folder_name)
    files = _list_files(service, fid)
    raw_candidates = _filter_drive_files(files, exts)
    candidates = [
        f for f in raw_candidates if _file_matches_sync_spec(f.get("name") or "", spec)
    ]
    skipped_filter = len(raw_candidates) - len(candidates)
    print(
        f"  Disponible en Drive '{drive_folder_name}': "
        f"{len(candidates)} archivo(s) tras filtro ({', '.join(exts)})"
    )
    if skipped_filter:
        print(f"  (Excluidos por prefijo/exclusión: {skipped_filter})")

    dest_dir.mkdir(parents=True, exist_ok=True)

    deleted = 0
    if full_replace and dest_dir.is_dir():
        for p in dest_dir.iterdir():
            if not p.is_file():
                continue
            if p.suffix.lower() not in exts:
                continue
            if not _file_matches_sync_spec(p.name, spec):
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


def _sync_key_is_raster_phase(key: str) -> bool:
    if key.startswith("raster_"):
        return True
    return (
        "_raster_monthly" in key
        or "_raster_yearly" in key
        or "_raster_trend" in key
    )


# Clave → especificación Drive → repo (``DriveSyncSpec``).
# AOD/NO2/SO2/LST: anuales y tendencia comparten carpeta Drive en el JS; se separan por prefijo.
SYNC_REGISTRY: dict[str, DriveSyncSpec] = {
    "raster_monthly": DriveSyncSpec(
        paths.DRIVE_RASTER_MONTHLY,
        paths.REPO_RASTER_NDVI_MONTHLY,
        (".tif", ".tiff"),
    ),
    "raster_yearly": DriveSyncSpec(
        paths.DRIVE_RASTER_YEARLY,
        paths.REPO_RASTER_NDVI_YEARLY,
        (".tif", ".tiff"),
    ),
    "raster_trend": DriveSyncSpec(
        paths.DRIVE_RASTER_TREND,
        paths.REPO_RASTER_NDVI_TREND,
        (".tif", ".tiff"),
    ),
    "raster_sd": DriveSyncSpec(
        paths.DRIVE_RASTER_SD,
        paths.REPO_RASTER_NDVI_SD,
        (".tif", ".tiff"),
    ),
    # El drive_folder de csv no se usa; la sync pasa por _sync_ndvi_csv_bundle.
    "csv": DriveSyncSpec(
        paths.DRIVE_CSV_MONTHLY,
        paths.REPO_CSV,
        (".csv",),
    ),
    "csv_yearmonth": DriveSyncSpec(
        paths.DRIVE_CSV_YEARMONTH,
        paths.REPO_NDVI_YEARMONTH_CSV,
        (".csv",),
    ),
    "geo_monthly_b": DriveSyncSpec(
        paths.DRIVE_GEO_MONTHLY_B,
        paths.REPO_GEOJSON_NDVI_MONTHLY_B,
        (".geojson", ".json"),
    ),
    "geo_monthly_m": DriveSyncSpec(
        paths.DRIVE_GEO_MONTHLY_M,
        paths.REPO_GEOJSON_NDVI_MONTHLY_M,
        (".geojson", ".json"),
    ),
    "geo_yearly_b": DriveSyncSpec(
        paths.DRIVE_GEO_YEARLY_B,
        paths.REPO_GEOJSON_NDVI_YEARLY_B,
        (".geojson", ".json"),
        stem_prefixes=("NDVI_Yearly_ZonalStats_Barrios_",),
    ),
    "geo_yearly_m": DriveSyncSpec(
        paths.DRIVE_GEO_YEARLY_M,
        paths.REPO_GEOJSON_NDVI_YEARLY_M,
        (".geojson", ".json"),
        stem_prefixes=("NDVI_Yearly_ZonalStats_Manzanas_",),
    ),
    "geo_sd_av": DriveSyncSpec(
        paths.DRIVE_GEO_SD_AV,
        paths.REPO_GEOJSON_NDVI_SD,
        (".geojson", ".json"),
    ),
    "geo_trend_b": DriveSyncSpec(
        paths.DRIVE_GEO_TREND_B,
        paths.REPO_GEOJSON_NDVI_TREND_B,
        (".geojson", ".json"),
        stem_prefixes=("Trend_NDVI_ZonalStats_Barrios",),
    ),
    "geo_trend_m": DriveSyncSpec(
        paths.DRIVE_GEO_TREND_M,
        paths.REPO_GEOJSON_NDVI_TREND_M,
        (".geojson", ".json"),
        stem_prefixes=("Trend_NDVI_ZonalStats_Manzanas",),
    ),
    # --- AOD ---
    "aod_raster_monthly": DriveSyncSpec(
        paths.DRIVE_AOD_RASTER_MONTHLY,
        paths.REPO_RASTER_AOD_MONTHLY,
        (".tif", ".tiff"),
    ),
    "aod_raster_yearly": DriveSyncSpec(
        paths.DRIVE_AOD_RASTER_YEARLY,
        paths.REPO_RASTER_AOD_YEARLY,
        (".tif", ".tiff"),
        stem_prefixes=("AOD_Yearly_",),
        stem_exclude_substrings=("Trend",),
    ),
    "aod_raster_trend": DriveSyncSpec(
        paths.DRIVE_AOD_RASTER_YEARLY,
        paths.REPO_RASTER_AOD_TREND,
        (".tif", ".tiff"),
        stem_prefixes=("AOD_Yearly_Trend",),
    ),
    "aod_csv_monthly": DriveSyncSpec(
        paths.DRIVE_AOD_CSV_MONTHLY,
        paths.REPO_CSV_AOD,
        (".csv",),
        stem_prefixes=("AOD_m_region",),
    ),
    "aod_csv_yearly": DriveSyncSpec(
        paths.DRIVE_AOD_CSV_YEARLY,
        paths.REPO_CSV_AOD,
        (".csv",),
        stem_prefixes=("AOD_y_region",),
    ),
    "aod_geo_monthly_b": DriveSyncSpec(
        paths.DRIVE_AOD_GEO_MONTHLY_B,
        paths.REPO_GEOJSON_AOD_MONTHLY_B,
        (".geojson", ".json"),
    ),
    "aod_geo_monthly_m": DriveSyncSpec(
        paths.DRIVE_AOD_GEO_MONTHLY_M,
        paths.REPO_GEOJSON_AOD_MONTHLY_M,
        (".geojson", ".json"),
    ),
    "aod_geo_yearly_b": DriveSyncSpec(
        paths.DRIVE_AOD_GEO_YEARLY_B,
        paths.REPO_GEOJSON_AOD_YEARLY_B,
        (".geojson", ".json"),
        stem_prefixes=("AOD_Yearly_ZonalStats_Barrios_",),
    ),
    "aod_geo_yearly_m": DriveSyncSpec(
        paths.DRIVE_AOD_GEO_YEARLY_M,
        paths.REPO_GEOJSON_AOD_YEARLY_M,
        (".geojson", ".json"),
        stem_prefixes=("AOD_Yearly_ZonalStats_Manzanas_",),
    ),
    "aod_geo_trend_b": DriveSyncSpec(
        paths.DRIVE_AOD_GEO_TREND_B,
        paths.REPO_GEOJSON_AOD_YEARLY_B,
        (".geojson", ".json"),
        stem_prefixes=("Trend_AOD_ZonalStats_Barrios",),
    ),
    "aod_geo_trend_m": DriveSyncSpec(
        paths.DRIVE_AOD_GEO_TREND_M,
        paths.REPO_GEOJSON_AOD_YEARLY_M,
        (".geojson", ".json"),
        stem_prefixes=("Trend_AOD_ZonalStats_Manzanas",),
    ),
    # --- NO2 ---
    "no2_raster_monthly": DriveSyncSpec(
        paths.DRIVE_NO2_RASTER_MONTHLY,
        paths.REPO_RASTER_NO2_MONTHLY,
        (".tif", ".tiff"),
    ),
    "no2_raster_yearly": DriveSyncSpec(
        paths.DRIVE_NO2_RASTER_YEARLY,
        paths.REPO_RASTER_NO2_YEARLY,
        (".tif", ".tiff"),
        stem_prefixes=("NO2_Yearly_",),
        stem_exclude_substrings=("Trend",),
    ),
    "no2_raster_trend": DriveSyncSpec(
        paths.DRIVE_NO2_RASTER_YEARLY,
        paths.REPO_RASTER_NO2_TREND,
        (".tif", ".tiff"),
        stem_prefixes=("NO2_Yearly_Trend",),
    ),
    "no2_csv_monthly": DriveSyncSpec(
        paths.DRIVE_NO2_CSV_MONTHLY,
        paths.REPO_CSV_NO2,
        (".csv",),
    ),
    "no2_csv_yearly": DriveSyncSpec(
        paths.DRIVE_NO2_CSV_YEARLY,
        paths.REPO_CSV_NO2,
        (".csv",),
    ),
    "no2_geo_monthly_b": DriveSyncSpec(
        paths.DRIVE_NO2_GEO_MONTHLY_B,
        paths.REPO_GEOJSON_NO2_MONTHLY_B,
        (".geojson", ".json"),
    ),
    "no2_geo_monthly_m": DriveSyncSpec(
        paths.DRIVE_NO2_GEO_MONTHLY_M,
        paths.REPO_GEOJSON_NO2_MONTHLY_M,
        (".geojson", ".json"),
    ),
    "no2_geo_yearly_b": DriveSyncSpec(
        paths.DRIVE_NO2_GEO_YEARLY_B,
        paths.REPO_GEOJSON_NO2_YEARLY_B,
        (".geojson", ".json"),
        stem_prefixes=("NO2_Yearly_ZonalStats_Barrios_",),
    ),
    "no2_geo_yearly_m": DriveSyncSpec(
        paths.DRIVE_NO2_GEO_YEARLY_M,
        paths.REPO_GEOJSON_NO2_YEARLY_M,
        (".geojson", ".json"),
        stem_prefixes=("NO2_Yearly_ZonalStats_Manzanas_",),
    ),
    "no2_geo_trend_b": DriveSyncSpec(
        paths.DRIVE_NO2_GEO_TREND_B,
        paths.REPO_GEOJSON_NO2_YEARLY_B,
        (".geojson", ".json"),
        stem_prefixes=("Trend_NO2_ZonalStats_Barrios",),
    ),
    "no2_geo_trend_m": DriveSyncSpec(
        paths.DRIVE_NO2_GEO_TREND_M,
        paths.REPO_GEOJSON_NO2_YEARLY_M,
        (".geojson", ".json"),
        stem_prefixes=("Trend_NO2_ZonalStats_Manzanas",),
    ),
    # --- SO2 ---
    "so2_raster_monthly": DriveSyncSpec(
        paths.DRIVE_SO2_RASTER_MONTHLY,
        paths.REPO_RASTER_SO2_MONTHLY,
        (".tif", ".tiff"),
    ),
    "so2_raster_yearly": DriveSyncSpec(
        paths.DRIVE_SO2_RASTER_YEARLY,
        paths.REPO_RASTER_SO2_YEARLY,
        (".tif", ".tiff"),
        stem_prefixes=("SO2_Yearly_",),
        stem_exclude_substrings=("Trend",),
    ),
    "so2_raster_trend": DriveSyncSpec(
        paths.DRIVE_SO2_RASTER_YEARLY,
        paths.REPO_RASTER_SO2_TREND,
        (".tif", ".tiff"),
        stem_prefixes=("SO2_Yearly_Trend",),
    ),
    "so2_csv_monthly": DriveSyncSpec(
        paths.DRIVE_SO2_CSV_MONTHLY,
        paths.REPO_CSV_SO2,
        (".csv",),
    ),
    "so2_csv_yearly": DriveSyncSpec(
        paths.DRIVE_SO2_CSV_YEARLY,
        paths.REPO_CSV_SO2,
        (".csv",),
    ),
    "so2_geo_monthly_b": DriveSyncSpec(
        paths.DRIVE_SO2_GEO_MONTHLY_B,
        paths.REPO_GEOJSON_SO2_MONTHLY_B,
        (".geojson", ".json"),
    ),
    "so2_geo_monthly_m": DriveSyncSpec(
        paths.DRIVE_SO2_GEO_MONTHLY_M,
        paths.REPO_GEOJSON_SO2_MONTHLY_M,
        (".geojson", ".json"),
    ),
    "so2_geo_yearly_b": DriveSyncSpec(
        paths.DRIVE_SO2_GEO_YEARLY_B,
        paths.REPO_GEOJSON_SO2_YEARLY_B,
        (".geojson", ".json"),
        stem_prefixes=("SO2_Yearly_ZonalStats_Barrios_",),
    ),
    "so2_geo_yearly_m": DriveSyncSpec(
        paths.DRIVE_SO2_GEO_YEARLY_M,
        paths.REPO_GEOJSON_SO2_YEARLY_M,
        (".geojson", ".json"),
        stem_prefixes=("SO2_Yearly_ZonalStats_Manzanas_",),
    ),
    "so2_geo_trend_b": DriveSyncSpec(
        paths.DRIVE_SO2_GEO_TREND_B,
        paths.REPO_GEOJSON_SO2_YEARLY_B,
        (".geojson", ".json"),
        stem_prefixes=("Trend_SO2_ZonalStats_Barrios",),
    ),
    "so2_geo_trend_m": DriveSyncSpec(
        paths.DRIVE_SO2_GEO_TREND_M,
        paths.REPO_GEOJSON_SO2_YEARLY_M,
        (".geojson", ".json"),
        stem_prefixes=("Trend_SO2_ZonalStats_Manzanas",),
    ),
    # --- LST ---
    "lst_raster_monthly": DriveSyncSpec(
        paths.DRIVE_LST_RASTER_MONTHLY,
        paths.REPO_RASTER_LST_MONTHLY,
        (".tif", ".tiff"),
    ),
    "lst_raster_yearly": DriveSyncSpec(
        paths.DRIVE_LST_RASTER_YEARLY,
        paths.REPO_RASTER_LST_YEARLY,
        (".tif", ".tiff"),
        stem_prefixes=("LST_Yearly_",),
        stem_exclude_substrings=("Trend",),
    ),
    "lst_raster_trend": DriveSyncSpec(
        paths.DRIVE_LST_RASTER_YEARLY,
        paths.REPO_RASTER_LST_TREND,
        (".tif", ".tiff"),
        stem_prefixes=("LST_Yearly_Trend",),
    ),
    "lst_csv_monthly": DriveSyncSpec(
        paths.DRIVE_LST_CSV_MONTHLY,
        paths.REPO_CSV_LST,
        (".csv",),
    ),
    "lst_csv_yearly": DriveSyncSpec(
        paths.DRIVE_LST_CSV_YEARLY,
        paths.REPO_CSV_LST,
        (".csv",),
    ),
    "lst_geo_monthly_b": DriveSyncSpec(
        paths.DRIVE_LST_GEO_MONTHLY_B,
        paths.REPO_GEOJSON_LST_MONTHLY_B,
        (".geojson", ".json"),
    ),
    "lst_geo_monthly_m": DriveSyncSpec(
        paths.DRIVE_LST_GEO_MONTHLY_M,
        paths.REPO_GEOJSON_LST_MONTHLY_M,
        (".geojson", ".json"),
    ),
    "lst_geo_yearly_b": DriveSyncSpec(
        paths.DRIVE_LST_GEO_YEARLY_B,
        paths.REPO_GEOJSON_LST_YEARLY_B,
        (".geojson", ".json"),
        stem_prefixes=("LST_Yearly_ZonalStats_Barrios_",),
    ),
    "lst_geo_yearly_m": DriveSyncSpec(
        paths.DRIVE_LST_GEO_YEARLY_M,
        paths.REPO_GEOJSON_LST_YEARLY_M,
        (".geojson", ".json"),
        stem_prefixes=("LST_Yearly_ZonalStats_Manzanas_",),
    ),
    "lst_geo_trend_b": DriveSyncSpec(
        paths.DRIVE_LST_GEO_TREND_B,
        paths.REPO_GEOJSON_LST_YEARLY_B,
        (".geojson", ".json"),
        stem_prefixes=("Trend_LST_ZonalStats_Barrios",),
    ),
    "lst_geo_trend_m": DriveSyncSpec(
        paths.DRIVE_LST_GEO_TREND_M,
        paths.REPO_GEOJSON_LST_YEARLY_M,
        (".geojson", ".json"),
        stem_prefixes=("Trend_LST_ZonalStats_Manzanas",),
    ),
    "lst_suhi_yearly": DriveSyncSpec(
        paths.DRIVE_LST_SUHI_YEARLY,
        paths.REPO_GEOJSON_LST_SUHI_YEARLY,
        (".geojson",),
        stem_prefixes=("LST_SUHI_Yearly_",),
    ),
    # --- Huella Urbana ---
    "hu_raster_yearly": DriveSyncSpec(
        paths.DRIVE_HU_YEARLY,
        paths.REPO_RASTER_HU_YEARLY,
        (".tif", ".tiff"),
        stem_prefixes=("Huella_Urbana_Yearly_",),
    ),
    "hu_csv_total": DriveSyncSpec(
        paths.DRIVE_HU_YEARLY,
        paths.REPO_CSV_HU,
        (".csv",),
        stem_prefixes=("Huella_Urbana_Anual",),
    ),
    "hu_csv_prc": DriveSyncSpec(
        paths.DRIVE_HU_YEARLY,
        paths.REPO_CSV_HU,
        (".csv",),
        stem_prefixes=("Areas_Huella_Urbana_Yearly",),
    ),
}

SYNC_KEYS_RASTER_PHASE: frozenset[str] = frozenset(
    k for k in SYNC_REGISTRY if _sync_key_is_raster_phase(k)
)
SYNC_KEYS_TABLE_PHASE: frozenset[str] = frozenset(SYNC_REGISTRY.keys()) - SYNC_KEYS_RASTER_PHASE


def sync_keys_for_export_categories(only: set[str] | None) -> list[str]:
    """
    Claves SYNC_REGISTRY alineadas con --only de pipeline/export (asset,raster,csv,geojson).
    Sirve cuando no se encoló nada a Drive pero igual hay que rellenar el repo desde Drive.
    """
    if only is None:
        return sorted(SYNC_REGISTRY.keys())
    keys: set[str] = set()
    if "raster" in only:
        keys.update(k for k in SYNC_REGISTRY if _sync_key_is_raster_phase(k))
    if "csv" in only:
        keys.update(
            k
            for k in SYNC_REGISTRY
            if k in ("csv", "csv_yearmonth")
            or k.endswith("_csv_monthly")
            or k.endswith("_csv_yearly")
        )
    if "geojson" in only:
        keys.update(
            k for k in SYNC_REGISTRY if k.startswith("geo_") or "_geo_" in k
        )
    return sorted(keys)


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
    full_replace_keys: set[str] | frozenset[str] | None = None,
    audit_product: str | None = None,
) -> int:
    """
    Descarga las carpetas indicadas desde Drive hacia REPO_*.

    Args:
        keys: Claves de SYNC_REGISTRY.
        dry_run: Si True, no escribe ni elimina archivos.
        full_replace: None = primera vez por clave es espejo completo, luego incremental;
            True = forzar espejo completo para todas las claves; False = solo incremental.
        full_replace_keys: Subconjunto de ``keys`` que se sincronizan en espejo completo
            aunque ``full_replace`` sea False o el modo guardado sea incremental (p. ej.
            tras reexportar NDVI_Monthly en Drive con el mismo nombre de archivo).
        audit_product: Si se pasa (p. ej. ``ndvi``), encabeza la sección con la variable
            para seguimiento en terminal.

    Returns:
        Suma de archivos descargados (o contados en dry-run) en todas las claves.
    """
    if audit_product:
        print_audit_block(
            f"Descarga Google Drive → repositorio local · {audit_product.upper()}"
        )
    print("Conectando a Google Drive…")
    service = _drive_service()
    modes = _load_key_modes()
    total = 0

    fr_keys = full_replace_keys or frozenset()
    for key in keys:
        spec = SYNC_REGISTRY[key]
        force_key = key in fr_keys
        if full_replace is True:
            use_full = True
        elif force_key:
            use_full = True
        elif full_replace is False:
            use_full = False
        else:
            use_full = modes.get(key) != "incremental"

        summary = sync_key_human_summary(key)
        if key == "csv":
            folders = ", ".join(_ndvi_csv_drive_folder_names())
            print(f"  ▸ [{key}] {summary}")
            print(f"Sincronizando [csv] Drive: {folders} -> {spec.dest_dir}")
        else:
            print(f"  ▸ [{key}] {summary}")
            print(f"Sincronizando [{key}] {spec.drive_folder} -> {spec.dest_dir}")
        if use_full:
            if full_replace is True:
                _reason = "global --full-sync"
            elif force_key:
                _reason = "forzado por drive_freshness (datos actualizados en Drive)"
            else:
                _reason = "primera sincronización para esta clave"
            print(f"  Modo: espejo completo (reemplaza gestionados en local) — {_reason}")
        else:
            print(f"  Modo: incremental (solo faltantes)")
        try:
            if key == "csv":
                total += _sync_ndvi_csv_bundle(
                    service,
                    spec.dest_dir,
                    spec.extensions,
                    dry_run=dry_run,
                    full_replace=use_full,
                )
            else:
                total += _sync_folder(
                    service,
                    spec,
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


def purge_stale_drive_files(
    keys: list[str] | None = None,
    *,
    dry_run: bool = False,
) -> int:
    """
    Remove files on Drive that match SYNC_REGISTRY specs.

    Useful for cleaning old/duplicate exports before a fresh run.
    Uses the same filtering (extensions, stem_prefixes, stem_exclude_substrings)
    as the sync process.
    """
    print("Conectando a Google Drive para limpieza…")
    service = _drive_service()
    target_keys = keys or sorted(SYNC_REGISTRY.keys())
    total = 0

    seen_folders: dict[str, bool] = {}
    for key in target_keys:
        spec = SYNC_REGISTRY[key]
        folder_key = f"{spec.drive_folder}|{spec.extensions}|{spec.stem_prefixes}|{spec.stem_exclude_substrings}"
        if folder_key in seen_folders:
            continue
        seen_folders[folder_key] = True

        print(f"\n  [{key}] Limpiando '{spec.drive_folder}' …")
        n = clear_drive_folder_files(
            service,
            spec.drive_folder,
            extensions=spec.extensions,
            stem_prefixes=spec.stem_prefixes or (),
            stem_exclude_substrings=spec.stem_exclude_substrings,
            dry_run=dry_run,
        )
        total += n
        if not n:
            print(f"    Sin archivos que eliminar.")

    mode = " (dry-run)" if dry_run else ""
    print(f"\nLimpieza completada: {total} archivo(s) eliminados en Drive{mode}")
    return total


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Descargar exportaciones GEE (NDVI, AOD, NO2, SO2, LST) de Google Drive al repo local."
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
        "--purge-drive",
        action="store_true",
        help="Eliminar archivos en Drive que coincidan con las claves. No descarga nada.",
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

    try:
        keys = parse_sync_keys(args.only)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)

    if args.purge_drive:
        purge_stale_drive_files(keys, dry_run=args.dry_run)
        return

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

    run_drive_sync(keys, dry_run=args.dry_run, full_replace=fr)


if __name__ == "__main__":
    main()
