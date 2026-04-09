"""Enqueue Huella Urbana exports."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ...config.enqueue_types import EnqueueResult
from ...config import paths
from ...drive.drive_export_gate import DriveExportGate
from ...lib import incremental_plan as incplan
from . import csv_tasks
from . import incremental as hu_inc
from . import raster_tasks


def _add_tasks(out: list[Any], items: list[Any] | Any | None) -> None:
    if items is None:
        return
    if isinstance(items, list):
        out.extend(t for t in items if t is not None)
    else:
        out.append(items)


def _hu_csv_stale(target_year: int) -> bool:
    """True if either HU CSV is missing or lacks a row for ``target_year``."""
    import re

    pat = re.compile(rf"^\s*{target_year}(?:\.0)?\s*[,;]", re.MULTILINE)
    for name in ("Huella_Urbana_Anual.csv", "Areas_Huella_Urbana_Yearly.csv"):
        p = paths.REPO_CSV_HU / name
        if not p.is_file():
            return True
        text = p.read_text(encoding="utf-8", errors="replace")
        if not pat.search(text):
            return True
    return False


def enqueue_hu_exports(
    *,
    only: set[str] | None = None,
    skip_yearly: bool = False,
    force_full: bool = False,
    drive_gate: DriveExportGate | None = None,
    drive_freshness=None,
    tables_run_override: bool | None = None,
    persist_state: bool = True,
) -> EnqueueResult:
    drive: list[Any] = []
    asset: list[Any] = []
    sync: set[str] = set()
    sync_full_mirror: set[str] = set()
    messages: list[str] = []
    ran_derivative = False

    def want(name: str) -> bool:
        return only is None or name in only

    missing_years = hu_inc.list_missing_hu_years()

    if missing_years:
        reason = f"{len(missing_years)} año(s) sin clasificar: {missing_years}"
        run = True
    else:
        reason = "Huella Urbana al día."
        run = False

    plan = incplan.DerivativePlan(
        run=run or force_full,
        reason=reason,
        max_ym=None,
        month_subset=None,
        years_touched=frozenset(missing_years),
        is_full_refresh=force_full,
        new_pairs=(),
    )

    if want("raster") and missing_years:
        _add_tasks(
            drive,
            raster_tasks.start_hu_yearly_raster_tasks(
                missing_years, drive_gate=drive_gate
            ),
        )
        sync.add("hu_raster_yearly")
        ran_derivative = True

    all_years = list(range(hu_inc.START_YEAR, hu_inc._target_last_year() + 1))
    tables_run = (
        run or force_full
        if tables_run_override is None
        else tables_run_override
    )
    csv_stale = _hu_csv_stale(hu_inc._target_last_year())
    if want("csv") and (tables_run or csv_stale):
        if csv_stale and not tables_run:
            messages.append(
                f"[CSV HU] CSV local sin datos para {hu_inc._target_last_year()}; re-exportando."
            )
        _add_tasks(
            drive,
            csv_tasks.start_hu_csv_tasks(all_years, drive_gate=drive_gate),
        )
        sync.update({"hu_csv_total", "hu_csv_prc"})
        ran_derivative = True

    if persist_state and ran_derivative and missing_years:
        hu_inc.save_last_year(max(missing_years))

    return EnqueueResult(
        plan=plan,
        drive_tasks=drive,
        asset_tasks=asset,
        sync_keys=sync,
        sync_full_mirror_keys=sync_full_mirror,
        ran_derivative=ran_derivative,
        messages=messages,
        state_saved=bool(persist_state and ran_derivative),
        state_path_msg=str(hu_inc.state_path()) if persist_state and ran_derivative else "",
    )
