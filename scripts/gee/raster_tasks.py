"""
Exportación de GeoTIFF y assets NDVI (traducción de NDVI_raster.txt — API Python).

La tendencia raster (`NDVI_t_raster`) usa Mann–Kendall + Sen como en el JS (`mk_sen_trend`).
"""
from __future__ import annotations

import time
import ee

from . import incremental
from . import mk_sen_trend
from . import paths
from . import vectors
from .drive_export_gate import DriveExportGate


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
) -> ee.batch.Task | None:
    """
    Tendencia multianual raster: Mann–Kendall + mediana de pendientes de Sen (NDVI_raster.txt).
    Archivo esperado en el repo: assets/data/raster/NDVI/NDVI_Trend/NDVI_Yearly_Trend.tif
    """
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    gran = vectors.gran_valparaiso()
    urban = vectors.area_urbana_feature()
    trend = mk_sen_trend.mk_sen_raster_trend_image(s2_ym, gran, urban)

    if drive_gate and drive_gate.should_skip_export(
        paths.DRIVE_RASTER_TREND,
        "NDVI_Yearly_Trend",
        (".tif", ".tiff"),
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
) -> list[ee.batch.Task]:
    """
    GeoTIFF NDVI_Monthly_01 … 12 → assets/data/raster/NDVI/NDVI_Monthly/
    month_numbers: si no es None, solo esos meses calendario (1–12).
    """
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    urban = vectors.area_urbana_feature().geometry()
    tasks = []

    months_loop = (
        range(1, 13) if month_numbers is None else sorted(m for m in month_numbers if 1 <= m <= 12)
    )
    if not months_loop:
        return tasks

    for m in months_loop:
        month_str = f"{m:02d}"
        stem = f"NDVI_Monthly_{month_str}"
        if drive_gate and drive_gate.should_skip_export(
            paths.DRIVE_RASTER_MONTHLY,
            stem,
            (".tif", ".tiff"),
        ):
            continue
        selected = s2_ym.select("NDVI_median").filter(ee.Filter.eq("month", m)).median()
        task = ee.batch.Export.image.toDrive(
            image=selected.clip(urban),
            description=f"NDVI_Monthly_{month_str}",
            folder=paths.DRIVE_RASTER_MONTHLY,
            fileNamePrefix=stem,
            scale=10,
            region=urban,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        task.start()
        tasks.append(task)
    return tasks


def start_ndvi_yearly_raster_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    year_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """
    GeoTIFF NDVI_Yearly_YYYY → assets/data/raster/NDVI/NDVI_Yearly/ (mismo patrón que el front).
    year_numbers: None = todos los años presentes en la colección; si no, solo esos años.
    """
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    urban = vectors.area_urbana_feature().geometry()
    tasks: list[ee.batch.Task] = []

    if year_numbers is None:
        years_raw = ee.List(s2_ym.aggregate_array("year")).distinct().sort().getInfo()
        years_loop = [int(y) for y in years_raw]
    else:
        years_loop = sorted(year_numbers)

    if not years_loop:
        return tasks

    for y in years_loop:
        stem = f"NDVI_Yearly_{y}"
        if drive_gate and drive_gate.should_skip_export(
            paths.DRIVE_RASTER_YEARLY,
            stem,
            (".tif", ".tiff"),
        ):
            continue
        selected = (
            s2_ym.select("NDVI_median")
            .filter(ee.Filter.calendarRange(y, y, "year"))
            .median()
        )
        task = ee.batch.Export.image.toDrive(
            image=selected.clip(urban),
            description=stem,
            folder=paths.DRIVE_RASTER_YEARLY,
            fileNamePrefix=stem,
            scale=10,
            region=urban,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        task.start()
        tasks.append(task)
    return tasks


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

    stem_sd = "NDVI_Monthly_StdDev_2024_2025"
    if drive_gate and drive_gate.should_skip_export(
        paths.DRIVE_RASTER_SD,
        stem_sd,
        (".tif", ".tiff"),
    ):
        return None

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


def start_ndvi_yearly_zonal_geojson_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """
    Estadística zonal anual (último año completo) barrios y manzanas — GeoJSON.
    Copiar a assets/data/geojson/NDVI/NDVI_Yearly_ZonalStats_{Barrios|Manzanas}/
    """
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    last_year = ee.Date(int(time.time() * 1000)).get("year").subtract(1).getInfo()

    img = (
        s2_ym.select("NDVI_median")
        .filter(ee.Filter.calendarRange(last_year, last_year, "year"))
        .median()
        .rename("NDVI")
    )

    tasks = []
    stem_b = f"NDVI_Yearly_ZonalStats_Barrios_{last_year}"
    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_GEO_YEARLY_B,
            stem_b,
            (".geojson", ".json"),
        )
    ):
        t1 = ee.batch.Export.table.toDrive(
            collection=img.reduceRegions(collection=barrios, reducer=ee.Reducer.mean(), scale=10).map(
                lambda f: f.set("Year", last_year)
            ),
            description=stem_b,
            folder=paths.DRIVE_GEO_YEARLY_B,
            fileNamePrefix=stem_b,
            fileFormat="GeoJSON",
            selectors=["NOMBRE", "POBLACION", "Year", "NDVI", ".geo"],
        )
        t1.start()
        tasks.append(t1)

    stem_m = f"NDVI_Yearly_ZonalStats_Manzanas_{last_year}"
    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_GEO_YEARLY_M,
            stem_m,
            (".geojson", ".json"),
        )
    ):
        t2 = ee.batch.Export.table.toDrive(
            collection=img.reduceRegions(
                collection=manzanas, reducer=ee.Reducer.mean(), scale=10
            ).map(lambda f: f.set("Year", last_year)),
            description=stem_m,
            folder=paths.DRIVE_GEO_YEARLY_M,
            fileNamePrefix=stem_m,
            fileFormat="GeoJSON",
            selectors=["MANZENT", "TOTAL_PERS", "Year", "NDVI", ".geo"],
        )
        t2.start()
        tasks.append(t2)
    return tasks
