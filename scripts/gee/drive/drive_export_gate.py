"""
Preflight en Google Drive antes de encolar exportaciones Earth Engine → Drive.

Si el archivo esperado (prefijo + extensión) ya está en la carpeta, no se encola la tarea.
Tras completar las tareas, usar `report_drive_vs_local` para comparar Drive con el repo
antes de `run_drive_sync`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..config import paths


@dataclass
class DriveExportGate:
    """Cache de listados por carpeta Drive para omitir exports redundantes."""

    service: Any
    enabled: bool = True
    _lower_names: dict[str, frozenset[str]] = field(default_factory=dict, repr=False)

    def invalidate(self, folder: str | None = None) -> None:
        """Tras nuevos exports, vaciar cache (p. ej. carpeta=None vacía todo)."""
        if folder is None:
            self._lower_names.clear()
        else:
            self._lower_names.pop(folder, None)

    def _names_lower(self, folder: str) -> frozenset[str]:
        if folder not in self._lower_names:
            from . import download_drive_to_repo
            _find_folder_id = download_drive_to_repo._find_folder_id
            _list_files = download_drive_to_repo._list_files

            try:
                fid = _find_folder_id(self.service, folder)
                files = _list_files(self.service, fid)
            except FileNotFoundError:
                self._lower_names[folder] = frozenset()
                return self._lower_names[folder]
            names: list[str] = []
            for f in files:
                n = f.get("name") or ""
                mime = f.get("mimeType") or ""
                if not n or mime.startswith("application/vnd.google-apps."):
                    continue
                names.append(n.lower())
            self._lower_names[folder] = frozenset(names)
        return self._lower_names[folder]

    def should_skip_export(
        self,
        folder: str,
        file_stem: str,
        extensions: tuple[str, ...],
        *,
        label: str | None = None,
    ) -> bool:
        """
        True si ya existe en Drive `file_stem` + alguna extensión (comparación en minúsculas).
        En ese caso imprime aviso y no debe encolarse el export EE.
        """
        if not self.enabled:
            return False
        names = self._names_lower(folder)
        sl = file_stem.lower()
        for ext in extensions:
            e = ext if str(ext).startswith(".") else f".{ext}"
            e = e.lower()
            candidate = f"{sl}{e}"
            if candidate in names:
                disp = label or candidate
                print(f"  [Drive] ya existe en '{folder}': {disp} — sin export EE.")
                return True
        return False

    def clear_before_reexport(
        self,
        folder: str,
        *,
        extensions: tuple[str, ...] = (".tif", ".tiff"),
        stem_prefixes: tuple[str, ...] | None = None,
        file_stems: tuple[str, ...] | None = None,
        stem_exclude_substrings: tuple[str, ...] = (),
    ) -> int:
        """
        Delete matching files on Drive before re-exporting.
        Invalidates the folder cache after deletion.
        Returns the number of files trashed.
        """
        if not self.enabled:
            return 0
        from . import download_drive_to_repo

        n = download_drive_to_repo.clear_drive_folder_files(
            self.service,
            folder,
            extensions=extensions,
            stem_prefixes=stem_prefixes,
            file_stems=file_stems,
            stem_exclude_substrings=stem_exclude_substrings,
        )
        if n:
            self.invalidate(folder)
        return n


def _local_basenames(dest: Path, extensions: tuple[str, ...]) -> set[str]:
    exts = tuple(e.lower() if e.startswith(".") else f".{e.lower()}" for e in extensions)
    if not dest.is_dir():
        return set()
    out: set[str] = set()
    for p in dest.iterdir():
        if p.is_file() and p.suffix.lower() in exts:
            out.add(p.name)
    return out


def report_drive_vs_local(
    service: Any,
    sync_keys: list[str],
    *,
    product: str | None = None,
) -> None:
    """Lista archivos en Drive vs locales por cada clave de sincronización."""
    from . import download_drive_to_repo
    from ..config import paths as config_paths
    
    SYNC_REGISTRY = download_drive_to_repo.SYNC_REGISTRY
    _file_matches_sync_spec = download_drive_to_repo._file_matches_sync_spec
    _filter_drive_files = download_drive_to_repo._filter_drive_files
    _find_folder_id = download_drive_to_repo._find_folder_id
    _list_files = download_drive_to_repo._list_files
    _ndvi_csv_drive_folder_names = download_drive_to_repo._ndvi_csv_drive_folder_names
    _normalize_exts = download_drive_to_repo._normalize_exts

    prod = f" · {product.upper()}" if product else ""
    print(f"\n=== Drive vs repositorio local (post-export){prod} ===\n")

    for key in sync_keys:
        if key == "csv":
            merged_drive: set[str] = set()
            for fn in _ndvi_csv_drive_folder_names():
                try:
                    fid = _find_folder_id(service, fn)
                    raw = _list_files(service, fid)
                    for f in _filter_drive_files(raw, (".csv",)):
                        n = f.get("name")
                        if n:
                            merged_drive.add(n)
                except FileNotFoundError:
                    print(f"  [{key}] Carpeta Drive inexistente: {fn}")
            local = _local_basenames(paths.REPO_CSV, (".csv",))
            only_drive = sorted(merged_drive - local)
            only_local = sorted(local - merged_drive)
            print(f"  [{key}] Drive (NDVI mensual/anual): {len(merged_drive)} .csv | Local: {len(local)} .csv")
            if only_drive:
                print(f"    Faltan en local ({len(only_drive)}): {', '.join(only_drive[:12])}{'…' if len(only_drive) > 12 else ''}")
            if only_local:
                print(f"    Solo en local (no en esas carpetas Drive): {len(only_local)} archivo(s)")
            continue

        spec = SYNC_REGISTRY[key]
        exts_n = _normalize_exts(spec.extensions)
        try:
            fid = _find_folder_id(service, spec.drive_folder)
            raw = _list_files(service, fid)
            drive_names = {
                f["name"]
                for f in _filter_drive_files(raw, exts_n)
                if f.get("name") and _file_matches_sync_spec(f["name"], spec)
            }
        except FileNotFoundError:
            print(f"  [{key}] Carpeta Drive inexistente: {spec.drive_folder}")
            continue

        local_names = {
            n
            for n in _local_basenames(Path(spec.dest_dir), exts_n)
            if download_drive_to_repo._file_matches_sync_spec(n, spec)
        }
        only_drive = sorted(drive_names - local_names)
        only_local = sorted(local_names - drive_names)
        print(f"  [{key}] {spec.drive_folder} -> {spec.dest_dir}")
        print(f"    En Drive: {len(drive_names)} | En local: {len(local_names)}")
        if only_drive:
            print(f"    A descargar / faltan en local ({len(only_drive)}): {', '.join(only_drive[:10])}{'…' if len(only_drive) > 10 else ''}")
        if only_local:
            print(f"    Solo en local: {len(only_local)} archivo(s)")
    print()
