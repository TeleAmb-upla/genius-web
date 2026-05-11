"""
Extracción unificada hacia Drive: mismas rutas para ``reduceRegions`` / tablas / GeoTIFF.

Cada producto prepara su ImageCollection y bandas; aquí se aplican siempre los mismos
patrones (mediana temporal mensual/anual, zonal_geojson con mediana espacial en polígonos,
CSV zonal barrios para NO₂/SO₂ y rasters regional de esos contaminantes). Las tablas urbanas
AOD/NO₂/SO₂ (``*_urban.csv``) se generan en el repo. No incluye Huella Urbana ni Iluminación.

API estable para NDVI, LST, AOD, NO2, SO2 vía los ``linear/*_tasks.py`` de cada uno.
"""
from __future__ import annotations

from typing import Any, Callable

import ee

from ..drive.drive_export_gate import DriveExportGate
from ..earth_engine_init import vectors
from ..products.atmosphere.spec import PollutantSpec
from . import mk_sen as mk_sen_lib
from . import monthly_climatology_percentiles as mcp
from . import yearmonth as ym_lib
from . import zonal_geojson
from .raster_web_quantize import int16_rounded_band, int16_scaled_band

# ---------------------------------------------------------------------------
# GeoJSON zonal (barrios + manzanas Quilpué) — mismo reduceRegions para todos
# ---------------------------------------------------------------------------


def monthly_zonal_geojson_barrios_manzanas(
    ic: ee.ImageCollection,
    *,
    source_band: str,
    value_property: str,
    stem_prefix: str,
    drive_folder_b: str,
    drive_folder_m: str,
    scale_m: float,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    image_transform: Callable[[ee.Image], ee.Image] | None = None,
) -> list[ee.batch.Task]:
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    tasks: list[ee.batch.Task] = []
    tasks += zonal_geojson.months_zonal_geojson_tasks(
        ic,
        source_band=source_band,
        value_property=value_property,
        stem_prefix=stem_prefix,
        unidad_fc=barrios,
        nombre_prefijo="Barrios",
        drive_folder=drive_folder_b,
        selectores=["NOMBRE", "POBLACION", "Month", value_property, ".geo"],
        scale_m=scale_m,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        image_transform=image_transform,
    )
    tasks += zonal_geojson.months_zonal_geojson_tasks(
        ic,
        source_band=source_band,
        value_property=value_property,
        stem_prefix=stem_prefix,
        unidad_fc=manzanas,
        nombre_prefijo="Manzanas",
        drive_folder=drive_folder_m,
        selectores=["MANZENT", "TOTAL_PERS", "Month", value_property, ".geo"],
        scale_m=scale_m,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        image_transform=image_transform,
    )
    return tasks


def yearly_zonal_geojson_barrios_manzanas(
    ic: ee.ImageCollection,
    *,
    source_band: str,
    value_property: str,
    stem_prefix: str,
    drive_folder_b: str,
    drive_folder_m: str,
    scale_m: float,
    last_year: int,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    image_transform: Callable[[ee.Image], ee.Image] | None = None,
) -> list[ee.batch.Task]:
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    tasks: list[ee.batch.Task] = []
    tasks += zonal_geojson.yearly_zonal_geojson_tasks_last_year(
        ic,
        source_band=source_band,
        value_property=value_property,
        stem_prefix=stem_prefix,
        last_year=last_year,
        year_numbers=year_numbers,
        unidad_fc=barrios,
        nombre_prefijo="Barrios",
        drive_folder=drive_folder_b,
        selectores=["NOMBRE", "POBLACION", "Year", value_property, ".geo"],
        scale_m=scale_m,
        drive_gate=drive_gate,
        image_transform=image_transform,
    )
    tasks += zonal_geojson.yearly_zonal_geojson_tasks_last_year(
        ic,
        source_band=source_band,
        value_property=value_property,
        stem_prefix=stem_prefix,
        last_year=last_year,
        year_numbers=year_numbers,
        unidad_fc=manzanas,
        nombre_prefijo="Manzanas",
        drive_folder=drive_folder_m,
        selectores=["MANZENT", "TOTAL_PERS", "Year", value_property, ".geo"],
        scale_m=scale_m,
        drive_gate=drive_gate,
        image_transform=image_transform,
    )
    return tasks


def trend_zonal_geojson_barrios_manzanas(
    slope_image: ee.Image,
    p_value_image: ee.Image,
    *,
    drive_folder_b: str,
    drive_folder_m: str,
    stem_b: str,
    stem_m: str,
    scale_m: float,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    return zonal_geojson.trend_zonal_geojson_tasks(
        slope_image,
        p_value_image,
        barrios=vectors.barrios_quilpue(),
        manzanas=vectors.manzanas_quilpue(),
        drive_folder_b=drive_folder_b,
        drive_folder_m=drive_folder_m,
        stem_b=stem_b,
        stem_m=stem_m,
        selectors_b=["NOMBRE", "POBLACION", "slope_median", "p_value", ".geo"],
        selectors_m=["MANZENT", "TOTAL_PERS", "slope_median", "p_value", ".geo"],
        scale_m=scale_m,
        drive_gate=drive_gate,
    )


# ---------------------------------------------------------------------------
# Rasters medianos (mensual climatológico / anual desde IC año–mes)
# ---------------------------------------------------------------------------


def monthly_climatology_raster_exports(
    ic: ee.ImageCollection,
    *,
    source_band: str,
    scale: float,
    clip_region: ee.Geometry,
    drive_folder: str,
    stem_prefix: str,
    month_numbers: frozenset[int] | None,
    drive_gate: DriveExportGate | None,
    bypass_drive_gate: bool,
    finalize_median_image: Callable[[ee.Image], ee.Image],
) -> list[ee.batch.Task]:
    """Por cada mes: mediana en *ic* → ``finalize_median_image`` → Export.image.toDrive."""
    tasks: list[ee.batch.Task] = []
    months_loop = (
        range(1, 13)
        if month_numbers is None
        else sorted(m for m in month_numbers if 1 <= m <= 12)
    )
    if not months_loop:
        return tasks
    for m in months_loop:
        month_str = f"{m:02d}"
        stem = f"{stem_prefix}_{month_str}"
        if (
            drive_gate
            and not bypass_drive_gate
            and drive_gate.should_skip_export(
                drive_folder,
                stem,
                (".tif", ".tiff"),
            )
        ):
            continue
        median_img = (
            ic.select(source_band)
            .filter(ee.Filter.eq("month", m))
            .median()
            .rename(source_band)
        )
        out = finalize_median_image(median_img)
        t = ee.batch.Export.image.toDrive(
            image=out.clip(clip_region),
            description=stem,
            folder=drive_folder,
            fileNamePrefix=stem,
            scale=scale,
            region=clip_region,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


def yearly_median_raster_exports_from_yearmonth(
    ic: ee.ImageCollection,
    *,
    source_band: str,
    scale: float,
    clip_region: ee.Geometry,
    drive_folder: str,
    stem_prefix: str,
    years_loop: list[int],
    year_lookup: dict[int, object] | None,
    drive_gate: DriveExportGate | None,
    bypass_drive_gate: bool,
    finalize_median_image: Callable[[ee.Image], ee.Image],
) -> list[ee.batch.Task]:
    if not years_loop:
        return []
    raw = ic.aggregate_array("year").distinct().sort().getInfo() or []
    lookup = year_lookup if year_lookup is not None else {int(y): y for y in raw}
    tasks: list[ee.batch.Task] = []
    for y in sorted(years_loop):
        stem = f"{stem_prefix}_{y}"
        if (
            drive_gate
            and not bypass_drive_gate
            and drive_gate.should_skip_export(
                drive_folder,
                stem,
                (".tif", ".tiff"),
            )
        ):
            continue
        orig_y = lookup.get(y, y)
        median_img = (
            ic.select(source_band)
            .filter(ee.Filter.eq("year", orig_y))
            .median()
            .rename(source_band)
        )
        out = finalize_median_image(median_img)
        t = ee.batch.Export.image.toDrive(
            image=out.clip(clip_region),
            description=stem,
            folder=drive_folder,
            fileNamePrefix=stem,
            scale=scale,
            region=clip_region,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


def finalize_int16_scaled(band: str, divisor: int) -> Callable[[ee.Image], ee.Image]:
    return lambda im: int16_scaled_band(im, band, divisor)


def finalize_int16_rounded(band: str) -> Callable[[ee.Image], ee.Image]:
    return lambda im: int16_rounded_band(im, band)


# ---------------------------------------------------------------------------
# NO2 / SO2 — CSV zonal mensual barrios; tablas urbanas en repo
# ---------------------------------------------------------------------------


def _pollutant_to_export_band(median_img: ee.Image, spec: PollutantSpec) -> ee.Image:
    """
    Una sola banda de salida con nombre ``export_band_name``.

    Las imágenes del asset año–mes NO₂/SO₂ concatenan varias bandas (mediana, percentiles,
    media, etc.). Sin ``select`` previo, ``expression`` / ``multiply`` actúan sobre todas
    y ``rename(un solo nombre)`` falla en el servidor.
    """
    img = ee.Image(median_img).select(spec.asset_median_band)
    if spec.regression_expr:
        return img.expression(spec.regression_expr).rename(spec.export_band_name)
    return img.multiply(1e6).rename(spec.export_band_name)


def csv_monthly_percentile_column_names(
    export_band_name: str,
) -> tuple[str, str, str]:
    if export_band_name.endswith("_median"):
        stem = export_band_name[: -len("_median")]
        return export_band_name, f"{stem}_p25", f"{stem}_p75"
    return export_band_name, f"{export_band_name}_p25", f"{export_band_name}_p75"


def pollutant_csv_export_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """
    CSV tabulares NO₂/SO₂: solo mensual zonal por barrio (Quilpué).
    No se exportan agregados región; serie urbana + año–mes en repo vía
    ``scripts/repo/bundles/build_atm_urban_csv_from_barrios.py``.
    """
    ic = ic or ee.ImageCollection(spec.asset_ym)
    region = vectors.region_valparaiso()
    tasks: list[ee.batch.Task] = []
    if spec.key not in ("no2", "so2"):
        return tasks

    months = ee.List.sequence(1, 12)
    prefix = spec.key.upper()
    b, bp25, bp75 = csv_monthly_percentile_column_names(spec.export_band_name)

    def _prep_pollutant_month_img(im: ee.Image) -> ee.Image:
        return _pollutant_to_export_band(ee.Image(im), spec).clip(region)

    _last_y, _last_m = ym_lib.last_complete_calendar_month_utc()
    barrios_z = vectors.barrios_quilpue()
    fn_zb = f"{prefix}_m_zonal_barrios"
    skip_zb = bool(
        drive_gate
        and drive_gate.should_skip_export(spec.drive_monthly, fn_zb, (".csv",))
    )
    if not skip_zb:

        def zonal_rows_per_barrio_month(mo: Any) -> ee.FeatureCollection:
            mo_n = ee.Number(mo)

            def row_for_barrio(feat: Any) -> ee.Feature:
                return mcp.pollutant_zonal_unit_month_row(
                    ic,
                    month=mo_n,
                    unit_fc=ee.FeatureCollection([ee.Feature(feat)]),
                    id_prop="NOMBRE",
                    wall_year=_last_y,
                    wall_month=_last_m,
                    scale=1113.2,
                    source_band=spec.asset_median_band,
                    export_band=spec.export_band_name,
                    image_prep=_prep_pollutant_month_img,
                    mid_col=b,
                    p25_col=bp25,
                    p75_col=bp75,
                )

            return barrios_z.map(row_for_barrio)

        fc_z_b = ee.FeatureCollection(
            months.map(zonal_rows_per_barrio_month)
        ).flatten()
        zonal_sel_b = ["NOMBRE", "Month", b, bp25, bp75, "anio_actual"]
        tzb = ee.batch.Export.table.toDrive(
            collection=fc_z_b,
            description=fn_zb,
            folder=spec.drive_monthly,
            fileNamePrefix=fn_zb,
            fileFormat="CSV",
            selectors=zonal_sel_b,
        )
        tzb.start()
        tasks.append(tzb)

    return tasks


def pollutant_monthly_raster_tasks(
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

    def finalize(im: ee.Image) -> ee.Image:
        out = _pollutant_to_export_band(im, spec)
        if spec.key == "no2":
            return int16_scaled_band(out, spec.export_band_name, 1000)
        return out

    return monthly_climatology_raster_exports(
        ic,
        source_band=spec.asset_median_band,
        scale=1113.2,
        clip_region=geom,
        drive_folder=spec.drive_monthly,
        stem_prefix=f"{spec.key.upper()}_Monthly",
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
        finalize_median_image=finalize,
    )


def pollutant_yearly_raster_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    ic = ic or ee.ImageCollection(spec.asset_ym)
    region = vectors.region_valparaiso()
    geom = region.geometry()
    if year_numbers is None:
        years_loop = [ym_lib.effective_yearly_export_year(ic)]
    else:
        years_loop = sorted(year_numbers)
    all_years_raw = ic.aggregate_array("year").distinct().sort().getInfo() or []
    year_lookup: dict[int, object] = {int(y): y for y in all_years_raw}

    def finalize(im: ee.Image) -> ee.Image:
        out = _pollutant_to_export_band(im, spec)
        if spec.key == "no2":
            return int16_scaled_band(out, spec.export_band_name, 1000)
        return out

    return yearly_median_raster_exports_from_yearmonth(
        ic,
        source_band=spec.asset_median_band,
        scale=1113.2,
        clip_region=geom,
        drive_folder=spec.drive_yearly,
        stem_prefix=f"{spec.key.upper()}_Yearly",
        years_loop=years_loop,
        year_lookup=year_lookup,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
        finalize_median_image=finalize,
    )


def pollutant_trend_raster_task(
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
        exp = _pollutant_to_export_band(raw, spec)
        t0 = ee.Date.fromYMD(y, 1, 1).millis()
        return exp.set("year", y).set("system:time_start", t0).clip(geom)

    annual = ee.ImageCollection.fromImages(years.map(one_year))
    trend = mk_sen_lib.mk_sen_raster_trend_masked_p_annual(
        annual,
        geom,
        spec.export_band_name,
        p_max=0.025,
    )
    if spec.key == "no2":
        trend = int16_scaled_band(trend, "trend", 10000)
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


def pollutant_monthly_geojson_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or ee.ImageCollection(spec.asset_ym)
    stem = f"{spec.key.upper()}_Monthly_ZonalStats"

    def xf(im: ee.Image) -> ee.Image:
        return _pollutant_to_export_band(im, spec)

    return monthly_zonal_geojson_barrios_manzanas(
        ic,
        source_band=spec.asset_median_band,
        value_property=spec.export_band_name,
        stem_prefix=stem,
        drive_folder_b=spec.drive_geo_m_b,
        drive_folder_m=spec.drive_geo_m_m,
        scale_m=1113.2,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        image_transform=xf,
    )


def pollutant_yearly_geojson_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or ee.ImageCollection(spec.asset_ym)
    ly = ym_lib.effective_yearly_export_year(ic)
    stem = f"{spec.key.upper()}_Yearly_ZonalStats"

    def xf(im: ee.Image) -> ee.Image:
        return _pollutant_to_export_band(im, spec)

    return yearly_zonal_geojson_barrios_manzanas(
        ic,
        source_band=spec.asset_median_band,
        value_property=spec.export_band_name,
        stem_prefix=stem,
        drive_folder_b=spec.drive_geo_y_b,
        drive_folder_m=spec.drive_geo_y_m,
        scale_m=1113.2,
        last_year=ly,
        year_numbers=year_numbers,
        drive_gate=drive_gate,
        image_transform=xf,
    )


def pollutant_trend_geojson_tasks(
    spec: PollutantSpec,
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or ee.ImageCollection(spec.asset_ym)
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
        exp = _pollutant_to_export_band(raw, spec)
        t0 = ee.Date.fromYMD(y, 1, 1).millis()
        return exp.set("year", y).set("system:time_start", t0)

    annual = ee.ImageCollection.fromImages(years.map(one_year))
    sens, pval = mk_sen_lib.mk_sen_slope_and_p_value_annual(
        annual, spec.export_band_name
    )
    return trend_zonal_geojson_barrios_manzanas(
        sens,
        pval,
        drive_folder_b=spec.drive_geo_y_b,
        drive_folder_m=spec.drive_geo_y_m,
        stem_b=spec.geo_trend_stem_b,
        stem_m=spec.geo_trend_stem_m,
        scale_m=1113.2,
        drive_gate=drive_gate,
    )
