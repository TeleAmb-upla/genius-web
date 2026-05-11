"""
Exportación de GeoTIFF y assets NDVI (traducción de NDVI_raster.txt — API Python).
Leer de arriba abajo (estilo Earth Engine Code Editor). API estable vía ``../raster_tasks.py``.
"""
from __future__ import annotations

import datetime

import ee

from .. import mk_sen_trend
from ....config import paths
from ....earth_engine_init import vectors
from ....drive.drive_export_gate import DriveExportGate
from ....lib import derivative_raster_export as dre
from ....lib import yearmonth as ym_lib
from ....lib.raster_web_quantize import int16_scaled_band
from .. import incremental


def _mask_s2_clouds(image: ee.Image) -> ee.Image:
    qa = image.select("QA60")
    mask = qa.bitwiseAnd(1 << 10).eq(0).And(qa.bitwiseAnd(1 << 11).eq(0))
    return image.updateMask(mask).divide(10000).copyProperties(
        image, image.propertyNames()
    )


def start_ndvi_ym_asset_tasks() -> list[ee.batch.Task]:
    """
    Rellena huecos mensuales en la ImageCollection asset NDVI_YearMonth (Sentinel-2).
    El sitio no sirve GeoTIFF por año-mes; la serie mensual en mapas usa NDVI_Monthly y
    los CSV (NDVI_m_* / NDVI_y_*).
    """
    asset_path = paths.ASSET_NDVI_YEARMONTH
    gran = vectors.gran_valparaiso()
    region = gran.geometry()

    missing = incremental.list_missing_ndvi_yearmonth_months()

    tasks: list[ee.batch.Task] = []
    if not missing:
        print("NDVI_YearMonth: sin huecos; no se encolan tareas.")
        return tasks

    print(f"NDVI_YearMonth: {len(missing)} meses a generar (solo asset).")

    for y, m in missing:
        m_start = ee.Date.fromYMD(y, m, 1)
        m_end = m_start.advance(1, "month")

        filtered = (
            ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
            .filterBounds(gran)
            .filterDate(m_start, m_end)
            .map(_mask_s2_clouds)
            .map(
                lambda img: img.addBands(
                    img.normalizedDifference(["B8", "B4"]).rename("NDVI")
                ).select("NDVI")
            )
        )

        n = filtered.size().getInfo()
        if n == 0:
            print(f"  Aviso: sin imágenes S2 para {y}-{m:02d}")
            continue

        median = filtered.median().rename("NDVI_median")
        perc = filtered.reduce(
            ee.Reducer.percentile([0, 25, 75, 100], ["p0", "p25", "p75", "p100"])
        )
        mean = filtered.mean().rename("NDVI_mean")
        sd = filtered.reduce(ee.Reducer.stdDev()).rename("NDVI_SD")
        count = filtered.count().rename("NDVI_count")

        image_return = (
            ee.Image([median, perc, mean, count, sd])
            .clip(gran)
            .set("year", y)
            .set("month", m)
            .set("system:time_start", ee.Date.fromYMD(y, m, 1).millis())
        )

        desc = f"NDVI_YearMonth_{y}_{m:02d}"
        t_asset = ee.batch.Export.image.toAsset(
            image=image_return,
            description=desc,
            assetId=f"{asset_path}/{desc}",
            scale=10,
            region=region,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t_asset.start()
        tasks.append(t_asset)

    return tasks


def start_ndvi_trend_raster_task(
    s2_ym: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> ee.batch.Task | None:
    """
    Tendencia multianual raster: Mann–Kendall + mediana de pendientes de Sen (NDVI_raster.txt).
    Export solo a la carpeta Drive ``DRIVE_RASTER_TREND`` (NDVI_Trend), no en NDVI_Yearly.
    Archivo en repo: NDVI_Trend/NDVI_Yearly_Trend.tif
    """
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    gran = vectors.gran_valparaiso()
    urban = vectors.area_urbana_feature()
    trend = mk_sen_trend.mk_sen_raster_trend_image(s2_ym, gran, urban)
    trend = int16_scaled_band(trend, "trend", 100000)

    if (
        drive_gate
        and not bypass_drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_RASTER_TREND,
            "NDVI_Yearly_Trend",
            (".tif", ".tiff"),
        )
    ):
        return None

    task = ee.batch.Export.image.toDrive(
        image=trend,
        description="NDVI_Yearly_Trend_export",
        folder=paths.DRIVE_RASTER_TREND,
        fileNamePrefix="NDVI_Yearly_Trend",
        scale=10,
        region=urban.geometry(),
        crs="EPSG:4326",
        maxPixels=1e13,
    )
    task.start()
    return task


def start_ndvi_monthly_climatology_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """
    GeoTIFF NDVI_Monthly_01 … 12 → assets/data/raster/NDVI/NDVI_Monthly/
    month_numbers: si no es None, solo esos meses calendario (1–12).
    bypass_drive_gate: si True, encola aunque exista el .tif en Drive (climatología desactualizada).
    """
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    urban = vectors.area_urbana_feature().geometry()
    return dre.start_monthly_climatology_raster_tasks(
        s2_ym,
        source_band="NDVI_median",
        scale=10,
        clip_region=urban,
        drive_folder=paths.DRIVE_RASTER_MONTHLY,
        stem_prefix="NDVI_Monthly",
        int16_quantize_divisor=10000,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_ndvi_yearly_raster_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    year_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """
    GeoTIFF NDVI_Yearly_YYYY → assets/data/raster/NDVI/NDVI_Yearly/ (mismo patrón que el front).
    ``year_numbers=None``: año anual efectivo (reloj UTC si el asset cubre ese año; si no, último completo en colección).
    """
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    urban = vectors.area_urbana_feature().geometry()

    if year_numbers is None:
        years_loop = [ym_lib.effective_yearly_export_year(s2_ym)]
    else:
        years_loop = sorted(year_numbers)

    if not years_loop:
        return []

    all_years_raw = (
        s2_ym.aggregate_array("year").distinct().sort().getInfo() or []
    )
    year_lookup: dict[int, object] = {int(y): y for y in all_years_raw}

    return dre.start_yearly_median_raster_tasks_from_yearmonth(
        s2_ym,
        source_band="NDVI_median",
        scale=10,
        clip_region=urban,
        drive_folder=paths.DRIVE_RASTER_YEARLY,
        stem_prefix="NDVI_Yearly",
        int16_quantize_divisor=10000,
        years_loop=years_loop,
        year_lookup=year_lookup,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_ndvi_sd_raster_task(
    s2_ym: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> ee.batch.Task | None:
    """
    Desviación estándar de NDVI_median en la ventana de ~24 meses hasta el último asset.
    Copiar a: assets/data/raster/NDVI/NDVI_SD/
    """
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    urban = vectors.area_urbana_feature()
    buffer = urban.geometry().buffer(1000)
    last_date = ee.Date(
        s2_ym.sort("system:time_start", False).first().get("system:time_start")
    )
    start_date = last_date.advance(-2, "year")
    sd = (
        s2_ym.filterDate(start_date, last_date.advance(1, "day"))
        .select("NDVI_median")
        .reduce(ee.Reducer.stdDev())
        .rename("NDVI_SD")
    )

    last_ms = int(last_date.millis().getInfo())
    last_dt = datetime.datetime.utcfromtimestamp(last_ms / 1000.0)
    start_dt = last_dt - datetime.timedelta(days=730)
    y0, y1 = sorted({start_dt.year, last_dt.year})
    stem_sd = f"NDVI_Monthly_StdDev_{y0}_{y1}"
    if drive_gate and drive_gate.should_skip_export(
        paths.DRIVE_RASTER_SD,
        stem_sd,
        (".tif", ".tiff"),
    ):
        return None

    sd = int16_scaled_band(sd, "NDVI_SD", 100000)
    task = ee.batch.Export.image.toDrive(
        image=sd.clip(urban.geometry()),
        description="NDVI_Monthly_StdDev",
        folder=paths.DRIVE_RASTER_SD,
        fileNamePrefix=stem_sd,
        scale=10,
        region=buffer,
        crs="EPSG:4326",
        maxPixels=1e13,
    )
    task.start()
    return task
