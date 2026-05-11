"""Tareas GEE compartidas NO2/SO2 (colección L3 + asset año-mes)."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import ee

from ...config.paths import export_state_path
from ...earth_engine_init import vectors
from ...drive.drive_export_gate import DriveExportGate
from ...lib import incremental_plan as incplan
from ...lib import state as state_lib
from ...lib import unified_product_extraction as upe
from ...lib import yearmonth as ym_lib
from .spec import PollutantSpec


def state_path(spec: PollutantSpec) -> Path:
    return export_state_path(spec.state_filename)


def list_missing_ym(spec: PollutantSpec) -> list[tuple[int, int]]:
    start_year = int(spec.filter_start.split("-", 1)[0])
    return ym_lib.list_missing_yearmonth_months(spec.asset_ym, start_year=start_year)


def plan_derivative_exports(
    spec: PollutantSpec,
    *,
    missing_asset_months: list[tuple[int, int]],
    force_full: bool,
) -> incplan.DerivativePlan:
    ic = ee.ImageCollection(spec.asset_ym)
    return incplan.plan_derivative_exports(
        missing_asset_months=missing_asset_months,
        force_full=force_full,
        ic=ic,
        state_path=state_path(spec),
    )


def save_last_processed_ym(spec: PollutantSpec, ym: tuple[int, int]) -> None:
    incplan.save_last_processed_ym(state_path(spec), ym)


def last_full_year_from_ic(ic: ee.ImageCollection) -> int:
    return ym_lib.last_full_calendar_year_from_yearmonth_ic(ic)


def load_last_trend_raster_full_year(spec: PollutantSpec) -> int | None:
    v = state_lib.read_state(state_path(spec)).get("last_trend_raster_full_year")
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def save_last_trend_raster_full_year(spec: PollutantSpec, year: int) -> None:
    state_lib.merge_state(state_path(spec), {"last_trend_raster_full_year": year})


def should_refresh_trend_raster(spec: PollutantSpec, ic: ee.ImageCollection) -> bool:
    lfy = ym_lib.effective_yearly_export_year(ic)
    sy = load_last_trend_raster_full_year(spec)
    if sy is None:
        return True
    return lfy > sy


def _mask_clouds_s5p(image: ee.Image) -> ee.Image:
    qa = image.select("cloud_fraction")
    mask = qa.lte(0.30)
    return image.updateMask(mask).copyProperties(image, image.propertyNames())


def _so2_atypical_mask(image: ee.Image) -> ee.Image:
    qa = image.select("SO2_column_number_density")
    mask = qa.gt(-0.001)
    return image.updateMask(mask)


def _base_l3(spec: PollutantSpec) -> ee.ImageCollection:
    region = vectors.region_valparaiso()
    end = ee.Date(int(time.time() * 1000))
    col = (
        ee.ImageCollection(spec.l3_collection)
        .filterDate(spec.filter_start, end)
        .select([spec.sensor_band, "cloud_fraction"])
        .map(lambda im: ee.Image(im).clip(region))
        .map(_mask_clouds_s5p)
    )
    if spec.key == "so2":
        col = col.map(_so2_atypical_mask)
    return col


def start_ym_asset_tasks(spec: PollutantSpec) -> list[ee.batch.Task]:
    region = vectors.region_valparaiso()
    geom = region.geometry()
    missing = list_missing_ym(spec)
    tasks: list[ee.batch.Task] = []
    if not missing:
        print(f"{spec.ym_prefix}: sin huecos; no se encolan tareas.")
        return tasks
    print(f"{spec.ym_prefix}: {len(missing)} meses a generar (solo asset).")
    l3 = _base_l3(spec)

    for y, m in missing:
        m_start = ee.Date.fromYMD(y, m, 1)
        m_end = m_start.advance(1, "month")
        selected = l3.filterDate(m_start, m_end)
        n = selected.size().getInfo()
        if n == 0:
            print(f"  Aviso: sin imágenes S5P {spec.key.upper()} para {y}-{m:02d}")
            continue
        sel = selected.select(spec.sensor_band)
        med = sel.median().rename(spec.asset_median_band)
        perc = sel.reduce(
            ee.Reducer.percentile([0, 25, 75, 100], ["p0", "p25", "p75", "p100"])
        )
        pfx = spec.asset_median_band.replace("_median", "")
        mean = sel.mean().rename(f"{pfx}_mean")
        sd = sel.reduce(ee.Reducer.stdDev()).rename(f"{pfx}_SD")
        cnt = sel.count().rename(f"{pfx}_count")
        if spec.key == "no2":
            join_c = cnt.unmask(0).rename("NO2_Count_Join")
        else:
            join_c = cnt.unmask(0).rename("SO2_Count_Join")
        img_return = ee.Image.cat([med, perc, mean, sd, join_c])

        t0 = selected.sort("system:time_start", True).first().get("system:time_start")
        image_return = (
            img_return.set("year", y)
            .set("month", m)
            .set("system:time_start", t0)
            .clip(region)
        )
        desc = f"{spec.ym_prefix}_{y}_{m:02d}"
        t = ee.batch.Export.image.toAsset(
            image=image_return,
            description=desc,
            assetId=f"{spec.asset_ym}/{desc}",
            scale=1113.2,
            region=geom,
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


def start_monthly_raster_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    return upe.pollutant_monthly_raster_tasks(
        spec,
        ic,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_yearly_raster_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    return upe.pollutant_yearly_raster_tasks(
        spec,
        ic,
        year_numbers=year_numbers,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_trend_raster_task(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> ee.batch.Task | None:
    return upe.pollutant_trend_raster_task(
        spec,
        ic,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_csv_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    return upe.pollutant_csv_export_tasks(spec, ic, drive_gate=drive_gate)


def start_m_geojson_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    return upe.pollutant_monthly_geojson_tasks(
        spec,
        ic,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
    )


def start_y_geojson_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    return upe.pollutant_yearly_geojson_tasks(
        spec,
        ic,
        year_numbers=year_numbers,
        drive_gate=drive_gate,
    )


def start_t_geojson_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    return upe.pollutant_trend_geojson_tasks(spec, ic, drive_gate=drive_gate)


# Re-export helpers used by tests / external scripts that imported from tasks_core.
def csv_monthly_percentile_column_names(
    export_band_name: str,
) -> tuple[str, str, str]:
    return upe.csv_monthly_percentile_column_names(export_band_name)
