"""
Exportación CSV NDVI (traducción de NDVI_csv.txt — API Python).
Zonal por barrios en CSV; manzanas solo GeoJSON.
Leer de arriba abajo (estilo Earth Engine Code Editor). API estable vía ``../csv_tasks.py``.
"""
from __future__ import annotations

from datetime import datetime

import ee

from ....config import paths
from ....earth_engine_init import vectors
from ....drive.drive_export_gate import DriveExportGate
from ....lib import monthly_climatology_percentiles as mcp
from ....lib import yearmonth as ym_lib


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
    _calendar_y = datetime.utcnow().year
    _last_y, _last_m = ym_lib.last_complete_calendar_month_utc()
    # Áreas verdes: año civil en curso; si aún no hay ningún mes cerrado de ese año (p. ej. enero),
    # ``wm_av=0`` → todas las columnas *_anio_actual en -9999 hasta febrero.
    _wy_av = _calendar_y
    _wm_av = _last_m if _last_y == _calendar_y else 0
    # Urbano y zonal: anclar siempre a ``(_last_y, _last_m)`` para no usar ``wm=0`` (1.gt(0) sería
    # verdadero para todos los meses y dejaría ``anio_actual`` todo en -9999). La auditoría local
    # (``drive_audit._ndvi_monthly_anio_actual_has_real_values``) rechaza CSV con ``anio_actual``
    # solo sentinela para forzar reexport en el pipeline.

    months = ee.List.sequence(1, 12)

    def av_row(mo):
        return mcp.ndvi_av_month_row(
            s2_ym,
            month=ee.Number(mo),
            gestion_fc=gestion_fc,
            planificacion_fc=planificacion_fc,
            area_urbana=area_urbana,
            wall_year=_wy_av,
            wall_month=_wm_av,
        )

    final_stats_m = ee.FeatureCollection(months.map(av_row))

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
            selectors=[
                "Month",
                "NDVI_Gestion",
                "NDVI_Planificacion",
                "NDVI_Urbano",
                "NDVI_Gestion_anio_actual",
                "NDVI_Planificacion_anio_actual",
                "NDVI_Urbano_anio_actual",
            ],
        )
        t_av.start()
        tasks.append(t_av)

    def urban_row(mo):
        return mcp.ndvi_urban_month_row(
            s2_ym,
            month=ee.Number(mo),
            area_urbana=area_urbana,
            wall_year=_last_y,
            wall_month=_last_m,
        )

    urban_m = ee.FeatureCollection(months.map(urban_row))
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
            selectors=["Month", "NDVI", "NDVI_p25", "NDVI_p75", "anio_actual"],
        )
        t_u.start()
        tasks.append(t_u)

    barrios = vectors.barrios_quilpue()

    def zonal_rows_per_barrio_month(mo):
        mo = ee.Number(mo)

        def row_for_barrio(feat):
            return mcp.ndvi_zonal_unit_month_row(
                s2_ym,
                month=mo,
                unit_fc=ee.FeatureCollection([ee.Feature(feat)]),
                id_prop="NOMBRE",
                wall_year=_last_y,
                wall_month=_last_m,
            )

        return barrios.map(row_for_barrio)

    fc_zonal_b = ee.FeatureCollection(months.map(zonal_rows_per_barrio_month)).flatten()

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_CSV_MONTHLY,
            "NDVI_m_zonal_barrios",
            (".csv",),
        )
    ):
        t_zb = ee.batch.Export.table.toDrive(
            collection=fc_zonal_b,
            description="NDVI_m_zonal_barrios",
            folder=paths.DRIVE_CSV_MONTHLY,
            fileNamePrefix="NDVI_m_zonal_barrios",
            fileFormat="CSV",
            selectors=["NOMBRE", "Month", "NDVI", "NDVI_p25", "NDVI_p75", "anio_actual"],
        )
        t_zb.start()
        tasks.append(t_zb)

    return tasks


def start_ndvi_y_csv_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    areas_verdes = vectors.areas_verdes()
    area_urbana = vectors.area_urbana_as_collection()
    gestion_fc, planificacion_fc = _preparar_colecciones(areas_verdes)

    max_export_year = ym_lib.last_completed_wall_clock_calendar_year()
    years = (
        ee.List(s2_ym.aggregate_array("year")).distinct().sort()
        .filter(ee.Filter.lte("item", max_export_year))
    )

    def stats_row(y):
        y = ee.Number(y)
        dg = ee.Dictionary(
            mcp.ndvi_intraannual_monthly_scalar_percentiles(
                s2_ym, year=y, fc=gestion_fc
            )
        )
        dp = ee.Dictionary(
            mcp.ndvi_intraannual_monthly_scalar_percentiles(
                s2_ym, year=y, fc=planificacion_fc
            )
        )
        du = ee.Dictionary(
            mcp.ndvi_intraannual_monthly_scalar_percentiles(
                s2_ym, year=y, fc=area_urbana
            )
        )
        return ee.Feature(
            None,
            {
                "Year": y,
                "NDVI_Gestion": ee.Number(dg.get("p50")).format("%.2f"),
                "NDVI_Planificacion": ee.Number(dp.get("p50")).format("%.2f"),
                "NDVI_Urbano": ee.Number(du.get("p50")).format("%.2f"),
                "NDVI_Gestion_p25": ee.Number(dg.get("p25")).format("%.2f"),
                "NDVI_Gestion_p75": ee.Number(dg.get("p75")).format("%.2f"),
                "NDVI_Planificacion_p25": ee.Number(dp.get("p25")).format("%.2f"),
                "NDVI_Planificacion_p75": ee.Number(dp.get("p75")).format("%.2f"),
                "NDVI_Urbano_p25": ee.Number(du.get("p25")).format("%.2f"),
                "NDVI_Urbano_p75": ee.Number(du.get("p75")).format("%.2f"),
            },
        )

    final_stats_y = ee.FeatureCollection(years.map(stats_row))

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
            selectors=[
                "Year",
                "NDVI_Gestion",
                "NDVI_Planificacion",
                "NDVI_Urbano",
                "NDVI_Gestion_p25",
                "NDVI_Gestion_p75",
                "NDVI_Planificacion_p25",
                "NDVI_Planificacion_p75",
                "NDVI_Urbano_p25",
                "NDVI_Urbano_p75",
            ],
        )
        t_av.start()
        tasks.append(t_av)

    def urban_only(y):
        y = ee.Number(y)
        d = ee.Dictionary(
            mcp.ndvi_intraannual_monthly_scalar_percentiles(
                s2_ym, year=y, fc=area_urbana
            )
        )
        return ee.Feature(
            None,
            {
                "Year": y,
                "NDVI": ee.Number(d.get("p50")).format("%.4f"),
                "NDVI_p25": ee.Number(d.get("p25")).format("%.4f"),
                "NDVI_p75": ee.Number(d.get("p75")).format("%.4f"),
            },
        )

    urban_y = ee.FeatureCollection(years.map(urban_only))
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
            selectors=["Year", "NDVI", "NDVI_p25", "NDVI_p75"],
        )
        t_u.start()
        tasks.append(t_u)

    barrios_y = vectors.barrios_quilpue()

    def barrio_rows_for_year(y):
        y = ee.Number(y)

        def one_b(feat):
            feat = ee.Feature(feat)
            fc = ee.FeatureCollection([feat])
            d = ee.Dictionary(
                mcp.ndvi_intraannual_monthly_scalar_percentiles(
                    s2_ym, year=y, fc=fc
                )
            )
            return ee.Feature(
                None,
                {
                    "Year": y,
                    "NOMBRE": feat.get("NOMBRE"),
                    "NDVI": ee.Number(d.get("p50")).format("%.4f"),
                    "NDVI_p25": ee.Number(d.get("p25")).format("%.4f"),
                    "NDVI_p75": ee.Number(d.get("p75")).format("%.4f"),
                },
            )

        return barrios_y.map(one_b)

    fc_y_z_b = ee.FeatureCollection(years.map(barrio_rows_for_year)).flatten()

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_CSV_YEARLY, "NDVI_y_zonal_barrios", (".csv",)
        )
    ):
        t_zb = ee.batch.Export.table.toDrive(
            collection=fc_y_z_b,
            description="NDVI_y_zonal_barrios",
            folder=paths.DRIVE_CSV_YEARLY,
            fileNamePrefix="NDVI_y_zonal_barrios",
            fileFormat="CSV",
            selectors=["Year", "NOMBRE", "NDVI", "NDVI_p25", "NDVI_p75"],
        )
        t_zb.start()
        tasks.append(t_zb)

    return tasks
