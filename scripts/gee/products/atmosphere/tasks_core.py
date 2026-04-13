"""Tareas GEE compartidas NO2/SO2 (colección L3 + asset año-mes)."""
from __future__ import annotations

import time
from pathlib import Path

import ee

from ...earth_engine_init import vectors
from ...drive.drive_export_gate import DriveExportGate
from ...lib import incremental_plan as incplan
from ...lib import mk_sen as mk_sen_lib
from ...lib import state as state_lib
from ...lib import yearmonth as ym_lib
from ...lib import zonal_geojson
from .spec import PollutantSpec


def state_path(spec: PollutantSpec) -> Path:
    return Path(__file__).resolve().parents[2] / spec.state_filename


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


def _to_export_band(median_img: ee.Image, spec: PollutantSpec) -> ee.Image:
    if spec.regression_expr:
        return median_img.expression(spec.regression_expr).rename(spec.export_band_name)
    return median_img.multiply(1e6).rename(spec.export_band_name)


def _attach_csv_props(
    feature: ee.Feature,
    time_key: str,
    time_value: object,
    value_property: str,
) -> ee.Feature:
    return ee.Feature(feature).set(time_key, time_value)


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
        # Una sola banda química: la colección L3 también trae cloud_fraction; si no se
        # selecciona, mean/sd/count devuelven 2 bandas y .rename("…_mean") falla en GEE.
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
    ic = ic or ee.ImageCollection(spec.asset_ym)
    region = vectors.region_valparaiso()
    geom = region.geometry()
    tasks: list[ee.batch.Task] = []
    months_loop = (
        range(1, 13) if month_numbers is None else sorted(x for x in month_numbers if 1 <= x <= 12)
    )
    for m in months_loop:
        ms = f"{m:02d}"
        stem = f"{spec.key.upper()}_Monthly_{ms}"
        if (
            drive_gate
            and not bypass_drive_gate
            and drive_gate.should_skip_export(spec.drive_monthly, stem, (".tif", ".tiff"))
        ):
            continue
        raw = ic.select(spec.asset_median_band).filter(ee.Filter.eq("month", m)).median()
        out = _to_export_band(raw, spec)
        t = ee.batch.Export.image.toDrive(
            image=out.clip(region),
            description=stem,
            folder=spec.drive_monthly,
            fileNamePrefix=stem,
            scale=1113.2,
            region=geom,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


def start_yearly_raster_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """
    Por defecto exporta solo el **último año civil completo** en la colección (coherente
    con AOD/NDVI/LST). Pasa ``year_numbers`` explícito para backfill multi-año.
    """
    ic = ic or ee.ImageCollection(spec.asset_ym)
    region = vectors.region_valparaiso()
    geom = region.geometry()
    tasks: list[ee.batch.Task] = []
    if year_numbers is None:
        years_loop = [ym_lib.effective_yearly_export_year(ic)]
    else:
        years_loop = sorted(year_numbers)

    all_years_raw = (
        ic.aggregate_array("year").distinct().sort().getInfo() or []
    )
    year_lookup: dict[int, object] = {int(y): y for y in all_years_raw}

    for y in years_loop:
        stem = f"{spec.key.upper()}_Yearly_{y}"
        if (
            drive_gate
            and not bypass_drive_gate
            and drive_gate.should_skip_export(
                spec.drive_yearly, stem, (".tif", ".tiff")
            )
        ):
            continue
        orig_y = year_lookup.get(y, y)
        raw = (
            ic.select(spec.asset_median_band)
            .filter(ee.Filter.eq("year", orig_y))
            .median()
        )
        out = _to_export_band(raw, spec)
        t = ee.batch.Export.image.toDrive(
            image=out.clip(region),
            description=stem,
            folder=spec.drive_yearly,
            fileNamePrefix=stem,
            scale=1113.2,
            region=geom,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


def start_trend_raster_task(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> ee.batch.Task | None:
    ic = ic or ee.ImageCollection(spec.asset_ym)
    region = vectors.region_valparaiso()
    geom = region.geometry()
    stem = f"{spec.key.upper()}_Yearly_Trend"
    if (
        drive_gate
        and not bypass_drive_gate
        and drive_gate.should_skip_export(spec.drive_yearly, stem, (".tif", ".tiff"))
    ):
        return None
    last_y = ym_lib.effective_yearly_export_year(ic)
    first = int(ee.Number(ic.sort("year").first().get("year")).getInfo())
    years = ee.List.sequence(first, last_y)

    def one_year(y):
        y = ee.Number(y)
        raw = (
            ic.select(spec.asset_median_band)
            .filter(ee.Filter.eq("year", y))
            .median()
        )
        exp = _to_export_band(raw, spec)
        t0 = ee.Date.fromYMD(y, 1, 1).millis()
        return exp.set("year", y).set("system:time_start", t0).clip(geom)

    annual = ee.ImageCollection.fromImages(years.map(one_year))
    trend = mk_sen_lib.mk_sen_raster_trend_masked_p_annual(
        annual,
        geom,
        spec.export_band_name,
        p_max=0.025,
    )
    t = ee.batch.Export.image.toDrive(
        image=trend,
        description=f"{spec.key.upper()}_Yearly_Trend_export",
        folder=spec.drive_yearly,
        fileNamePrefix=stem,
        scale=1113.2,
        region=geom,
        crs="EPSG:4326",
        maxPixels=1e13,
    )
    t.start()
    return t


def start_csv_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or ee.ImageCollection(spec.asset_ym)
    region = vectors.region_valparaiso()
    tasks: list[ee.batch.Task] = []
    months = ee.List.sequence(1, 12)
    by_month = ee.ImageCollection.fromImages(
        months.map(
            lambda m: _to_export_band(
                ic.select(spec.asset_median_band)
                .filter(ee.Filter.eq("month", m))
                .median(),
                spec,
            ).set("month", m).clip(region)
        )
    )
    triplets_m = by_month.map(
        lambda image: image.reduceRegions(
            collection=region, reducer=ee.Reducer.mean(), scale=1113.2
        ).map(
            lambda f: _attach_csv_props(
                f,
                "Month",
                image.get("month"),
                spec.export_band_name,
            )
        )
    ).flatten()
    prefix = spec.key.upper()
    fn_m = f"{prefix}_m_region"
    if not (
        drive_gate
        and drive_gate.should_skip_export(spec.drive_monthly, fn_m, (".csv",))
    ):
        t1 = ee.batch.Export.table.toDrive(
            collection=triplets_m,
            selectors=["Month", spec.export_band_name],
            description=fn_m,
            fileNamePrefix=fn_m,
            folder=spec.drive_monthly,
            fileFormat="CSV",
        )
        t1.start()
        tasks.append(t1)

    max_export_year = ym_lib.last_completed_wall_clock_calendar_year()
    all_years_raw = ic.aggregate_array("year").distinct().sort().getInfo() or []
    years = ee.List(
        [y for y in all_years_raw if int(y) <= max_export_year]
    )
    by_year = ee.ImageCollection.fromImages(
        years.map(
            lambda y: _to_export_band(
                ic.select(spec.asset_median_band)
                .filter(ee.Filter.eq("year", y))
                .median(),
                spec,
            ).set("year", y).clip(region)
        )
    )
    triplets_y = by_year.map(
        lambda image: image.reduceRegions(
            collection=region, reducer=ee.Reducer.mean(), scale=1113.2
        ).map(
            lambda f: _attach_csv_props(
                f,
                "Year",
                image.get("year"),
                spec.export_band_name,
            )
        )
    ).flatten()
    fn_y = f"{prefix}_y_region"
    if not (
        drive_gate and drive_gate.should_skip_export(spec.drive_yearly, fn_y, (".csv",))
    ):
        t2 = ee.batch.Export.table.toDrive(
            collection=triplets_y,
            selectors=["Year", spec.export_band_name],
            description=fn_y,
            fileNamePrefix=fn_y,
            folder=spec.drive_yearly,
            fileFormat="CSV",
        )
        t2.start()
        tasks.append(t2)
    return tasks


def start_m_geojson_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or ee.ImageCollection(spec.asset_ym)
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    stem = f"{spec.key.upper()}_Monthly_ZonalStats"
    tasks: list[ee.batch.Task] = []
    tasks += zonal_geojson.months_zonal_geojson_tasks(
        ic,
        source_band=spec.asset_median_band,
        value_property=spec.export_band_name,
        stem_prefix=stem,
        unidad_fc=barrios,
        nombre_prefijo="Barrios",
        drive_folder=spec.drive_geo_m_b,
        selectores=["NOMBRE", "POBLACION", "Month", spec.export_band_name, ".geo"],
        scale_m=1113.2,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        image_transform=lambda image: _to_export_band(image, spec),
    )
    tasks += zonal_geojson.months_zonal_geojson_tasks(
        ic,
        source_band=spec.asset_median_band,
        value_property=spec.export_band_name,
        stem_prefix=stem,
        unidad_fc=manzanas,
        nombre_prefijo="Manzanas",
        drive_folder=spec.drive_geo_m_m,
        selectores=["MANZENT", "TOTAL_PERS", "Month", spec.export_band_name, ".geo"],
        scale_m=1113.2,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        image_transform=lambda image: _to_export_band(image, spec),
    )
    return tasks


def start_y_geojson_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or ee.ImageCollection(spec.asset_ym)
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    ly = ym_lib.effective_yearly_export_year(ic)
    stem = f"{spec.key.upper()}_Yearly_ZonalStats"
    tasks: list[ee.batch.Task] = []
    tasks += zonal_geojson.yearly_zonal_geojson_tasks_last_year(
        ic,
        source_band=spec.asset_median_band,
        value_property=spec.export_band_name,
        stem_prefix=stem,
        last_year=ly,
        year_numbers=year_numbers,
        unidad_fc=barrios,
        nombre_prefijo="Barrios",
        drive_folder=spec.drive_geo_y_b,
        selectores=["NOMBRE", "POBLACION", "Year", spec.export_band_name, ".geo"],
        scale_m=1113.2,
        drive_gate=drive_gate,
        image_transform=lambda image: _to_export_band(image, spec),
    )
    tasks += zonal_geojson.yearly_zonal_geojson_tasks_last_year(
        ic,
        source_band=spec.asset_median_band,
        value_property=spec.export_band_name,
        stem_prefix=stem,
        last_year=ly,
        year_numbers=year_numbers,
        unidad_fc=manzanas,
        nombre_prefijo="Manzanas",
        drive_folder=spec.drive_geo_y_m,
        selectores=["MANZENT", "TOTAL_PERS", "Year", spec.export_band_name, ".geo"],
        scale_m=1113.2,
        drive_gate=drive_gate,
        image_transform=lambda image: _to_export_band(image, spec),
    )
    return tasks


def start_t_geojson_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or ee.ImageCollection(spec.asset_ym)
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    last_y = ym_lib.effective_yearly_export_year(ic)
    first = int(ee.Number(ic.sort("year").first().get("year")).getInfo())
    years = ee.List.sequence(first, last_y)

    def one_year(y):
        y = ee.Number(y)
        raw = (
            ic.select(spec.asset_median_band)
            .filter(ee.Filter.eq("year", y))
            .median()
        )
        exp = _to_export_band(raw, spec)
        t0 = ee.Date.fromYMD(y, 1, 1).millis()
        return exp.set("year", y).set("system:time_start", t0)

    annual = ee.ImageCollection.fromImages(years.map(one_year))
    sens, pval = mk_sen_lib.mk_sen_slope_and_p_value_annual(
        annual, spec.export_band_name
    )
    return zonal_geojson.trend_zonal_geojson_tasks(
        sens,
        pval,
        barrios=barrios,
        manzanas=manzanas,
        drive_folder_b=spec.drive_geo_y_b,
        drive_folder_m=spec.drive_geo_y_m,
        stem_b=spec.geo_trend_stem_b,
        stem_m=spec.geo_trend_stem_m,
        selectors_b=["NOMBRE", "POBLACION", "slope_median", "p_value", ".geo"],
        selectors_m=["MANZENT", "TOTAL_PERS", "slope_median", "p_value", ".geo"],
        scale_m=1113.2,
        drive_gate=drive_gate,
    )
