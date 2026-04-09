"""
Exportación CSV NDVI (traducción de NDVI_csv.txt — API Python).

Archivos alineados al front-end:
- NDVI_m_av.csv / NDVI_y_av.csv — áreas verdes (gestión / planificación / urbano agregado)
- NDVI_m_urban.csv / NDVI_y_urban.csv — solo área urbana, columnas Month|Year y NDVI
- NDVI_YearMonth_urban.csv — una fila por (Year, Month) en el asset, NDVI medio urbano
"""
from __future__ import annotations

import ee

from ...config import paths
from ...earth_engine_init import vectors
from ...drive.drive_export_gate import DriveExportGate


def _preparar_colecciones(areas_verdes: ee.FeatureCollection):
    gestion_fc = areas_verdes.filter(
        ee.Filter.inList("CATEGORIA", ["Mantencion_General", "AV_ParqueUrbano"])
    ).map(lambda f: f.set({"Clasificacion": "Gestion"}))

    planificacion_fc = areas_verdes.filter(
        ee.Filter.inList(
            "CATEGORIA",
            [
                "AV_Consolidadas",
                "AV_COMUNALESPUBLICAS_ESTEROQUILPUE",
                "AV_ComunalesPublicas_Quebradas",
                "AV_ComunalesPrivadas_Agrestes",
                "AV_IntComunalesPrivadas_Recreativas",
                "AV_IntComunalesPrivadas_ResguardoPatrimonial",
                "AV_IntComunalesPrivadas_Agrestes",
                "AV_IntComunalesPúblicas_ParqueIntercomunal",
            ],
        )
    ).map(lambda f: f.set({"Clasificacion": "Planificacion"}))

    return gestion_fc, planificacion_fc


def start_ndvi_m_csv_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    areas_verdes = vectors.areas_verdes()
    area_urbana = vectors.area_urbana_as_collection()
    gestion_fc, planificacion_fc = _preparar_colecciones(areas_verdes)

    months = ee.List(s2_ym.aggregate_array("month")).distinct().sort()

    def month_image(m):
        m = ee.Number(m)
        selected = s2_ym.select("NDVI_median").filter(ee.Filter.eq("month", m))
        return ee.Image([selected.median().rename("NDVI")]).set("month", m)

    ndvi_by_month = ee.ImageCollection.fromImages(months.map(month_image))

    def stats_row(img):
        img = ee.Image(img)
        g_stats = img.reduceRegions(
            collection=gestion_fc, reducer=ee.Reducer.mean(), scale=10
        )
        p_stats = img.reduceRegions(
            collection=planificacion_fc, reducer=ee.Reducer.mean(), scale=10
        )
        u_stats = img.reduceRegions(
            collection=area_urbana, reducer=ee.Reducer.mean(), scale=10
        )
        return ee.Feature(
            None,
            {
                "Month": img.get("month"),
                "NDVI_Gestion": ee.Number(g_stats.aggregate_mean("mean")).format("%.2f"),
                "NDVI_Planificacion": ee.Number(p_stats.aggregate_mean("mean")).format(
                    "%.2f"
                ),
                "NDVI_Urbano": ee.Number(u_stats.aggregate_mean("mean")).format("%.2f"),
            },
        )

    final_stats_m = ndvi_by_month.map(stats_row)

    tasks = []

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_CSV_MONTHLY,
            "NDVI_m_av",
            (".csv",),
        )
    ):
        t_av = ee.batch.Export.table.toDrive(
            collection=final_stats_m,
            description="NDVI_m_av",
            folder=paths.DRIVE_CSV_MONTHLY,
            fileNamePrefix="NDVI_m_av",
            fileFormat="CSV",
            selectors=["Month", "NDVI_Gestion", "NDVI_Planificacion", "NDVI_Urbano"],
        )
        t_av.start()
        tasks.append(t_av)

    # Serie mensual simple para gráficos (assets/data/csv/NDVI_m_urban.csv)
    def urban_only(img):
        img = ee.Image(img)
        u_stats = img.reduceRegions(
            collection=area_urbana, reducer=ee.Reducer.mean(), scale=10
        )
        return ee.Feature(
            None,
            {
                "Month": img.get("month"),
                "NDVI": ee.Number(u_stats.aggregate_mean("mean")).format("%.4f"),
            },
        )

    urban_m = ndvi_by_month.map(urban_only)
    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_CSV_MONTHLY,
            "NDVI_m_urban",
            (".csv",),
        )
    ):
        t_u = ee.batch.Export.table.toDrive(
            collection=urban_m,
            description="NDVI_m_urban",
            folder=paths.DRIVE_CSV_MONTHLY,
            fileNamePrefix="NDVI_m_urban",
            fileFormat="CSV",
            selectors=["Month", "NDVI"],
        )
        t_u.start()
        tasks.append(t_u)

    return tasks


def start_ndvi_ym_csv_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """
    Tabla larga año-mes (Year, Month, NDVI) sobre área urbana, desde el asset NDVI_YearMonth.
    Export a DRIVE_CSV_YEARMONTH; descarga a REPO_NDVI_YEARMONTH_CSV.
    """
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    urban = vectors.area_urbana_feature().geometry()

    def row(img: ee.Image) -> ee.Feature:
        img = ee.Image(img)
        # Sin píxeles válidos en urbano, reduceRegion devuelve null y Number.format falla.
        ndvi = img.select("NDVI_median").unmask(-9999)
        mu = ndvi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=urban,
            scale=10,
            maxPixels=1e13,
        ).get("NDVI_median")
        return ee.Feature(
            None,
            {
                "Year": img.get("year"),
                "Month": img.get("month"),
                "NDVI": ee.Number(mu).format("%.4f"),
            },
        )

    fc = s2_ym.map(row)
    if drive_gate and drive_gate.should_skip_export(
        paths.DRIVE_CSV_YEARMONTH,
        "NDVI_YearMonth_urban",
        (".csv",),
    ):
        return []
    t = ee.batch.Export.table.toDrive(
        collection=fc,
        description="NDVI_YearMonth_urban",
        folder=paths.DRIVE_CSV_YEARMONTH,
        fileNamePrefix="NDVI_YearMonth_urban",
        fileFormat="CSV",
        selectors=["Year", "Month", "NDVI"],
    )
    t.start()
    return [t]


def start_ndvi_y_csv_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    areas_verdes = vectors.areas_verdes()
    area_urbana = vectors.area_urbana_as_collection()
    gestion_fc, planificacion_fc = _preparar_colecciones(areas_verdes)

    years = ee.List(s2_ym.aggregate_array("year")).distinct().sort()

    def year_image(y):
        y = ee.Number(y)
        selected = s2_ym.select("NDVI_median").filter(ee.Filter.eq("year", y))
        return ee.Image([selected.median().rename("NDVI")]).set("year", y)

    ndvi_by_year = ee.ImageCollection.fromImages(years.map(year_image))

    def stats_row(img):
        img = ee.Image(img)
        g_stats = img.reduceRegions(
            collection=gestion_fc, reducer=ee.Reducer.mean(), scale=10
        )
        p_stats = img.reduceRegions(
            collection=planificacion_fc, reducer=ee.Reducer.mean(), scale=10
        )
        u_stats = img.reduceRegions(
            collection=area_urbana, reducer=ee.Reducer.mean(), scale=10
        )
        return ee.Feature(
            None,
            {
                "Year": img.get("year"),
                "NDVI_Gestion": ee.Number(g_stats.aggregate_mean("mean")).format("%.2f"),
                "NDVI_Planificacion": ee.Number(p_stats.aggregate_mean("mean")).format(
                    "%.2f"
                ),
                "NDVI_Urbano": ee.Number(u_stats.aggregate_mean("mean")).format("%.2f"),
            },
        )

    final_stats_y = ndvi_by_year.map(stats_row)

    tasks = []
    if not (
        drive_gate
        and drive_gate.should_skip_export(paths.DRIVE_CSV_YEARLY, "NDVI_y_av", (".csv",))
    ):
        t_av = ee.batch.Export.table.toDrive(
            collection=final_stats_y,
            description="NDVI_y_av",
            folder=paths.DRIVE_CSV_YEARLY,
            fileNamePrefix="NDVI_y_av",
            fileFormat="CSV",
            selectors=["Year", "NDVI_Gestion", "NDVI_Planificacion", "NDVI_Urbano"],
        )
        t_av.start()
        tasks.append(t_av)

    def urban_only(img):
        img = ee.Image(img)
        u_stats = img.reduceRegions(
            collection=area_urbana, reducer=ee.Reducer.mean(), scale=10
        )
        return ee.Feature(
            None,
            {
                "Year": img.get("year"),
                "NDVI": ee.Number(u_stats.aggregate_mean("mean")).format("%.4f"),
            },
        )

    urban_y = ndvi_by_year.map(urban_only)
    if not (
        drive_gate
        and drive_gate.should_skip_export(paths.DRIVE_CSV_YEARLY, "NDVI_y_urban", (".csv",))
    ):
        t_u = ee.batch.Export.table.toDrive(
            collection=urban_y,
            description="NDVI_y_urban",
            folder=paths.DRIVE_CSV_YEARLY,
            fileNamePrefix="NDVI_y_urban",
            fileFormat="CSV",
            selectors=["Year", "NDVI"],
        )
        t_u.start()
        tasks.append(t_u)

    return tasks
