"""
CSV exports for Huella Urbana.

- Huella_Urbana_Anual.csv: Year, Hectareas (urban area in distritos urbanos)
- Areas_Huella_Urbana_Yearly.csv: Year, Area_DentroPRC, Area_FueraPRC, Precision_Kappa
"""
from __future__ import annotations

import ee

from ...config import paths
from ...drive.drive_export_gate import DriveExportGate
from . import raster_tasks as rt


def start_hu_csv_tasks(
    years: list[int],
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """Build the Huella Urbana collection for ``years`` and export CSV stats."""
    if not years:
        return []

    aoi = rt._aoi()
    classifier = rt._train_rf_model(aoi)
    urbanos = ee.FeatureCollection(rt.DISTRITOS_URBANOS)
    prc = ee.FeatureCollection(rt.PRC_QUILPUE)
    table = ee.FeatureCollection(rt.AOI_UPLA)

    images = [rt._classify_year(y, classifier, aoi) for y in years]
    hu_ic = ee.ImageCollection.fromImages(images)

    col_hu = hu_ic.map(
        lambda image: image.addBands(
            ee.Image.pixelArea()
            .divide(10000)
            .updateMask(image.eq(1))
            .rename("pixel_area")
        )
    )

    tasks: list[ee.batch.Task] = []

    # --- Total hectares CSV ---
    stem_total = "Huella_Urbana_Anual_Total"
    if not (
        drive_gate
        and drive_gate.should_skip_export(paths.DRIVE_HU_YEARLY, stem_total, (".csv",))
    ):
        triplets = col_hu.map(
            lambda image: ee.Feature(
                None,
                {
                    "Year": image.get("year"),
                    "Hectareas": ee.Number(
                        image.select("pixel_area")
                        .reduceRegion(
                            reducer=ee.Reducer.sum(),
                            geometry=urbanos.geometry(),
                            scale=10,
                            maxPixels=1e10,
                        )
                        .get("pixel_area")
                    ).format("%.2f"),
                },
            )
        )
        t1 = ee.batch.Export.table.toDrive(
            collection=triplets,
            selectors=["Year", "Hectareas"],
            description=stem_total,
            fileNamePrefix="Huella_Urbana_Anual",
            folder=paths.DRIVE_HU_YEARLY,
            fileFormat="CSV",
        )
        t1.start()
        tasks.append(t1)

    # --- PRC areas CSV ---
    stem_prc = "Areas_Huella_Urbana_Yearly_PRC"
    if not (
        drive_gate
        and drive_gate.should_skip_export(paths.DRIVE_HU_YEARLY, stem_prc, (".csv",))
    ):
        mask_prc_dentro = ee.Image.constant(1).clip(prc).mask()
        mask_prc_fuera = mask_prc_dentro.Not()

        hu_prc = col_hu.map(
            lambda image: image.addBands(
                [
                    image.select("pixel_area")
                    .updateMask(mask_prc_dentro)
                    .rename("area_dentroPRC"),
                    image.select("pixel_area")
                    .updateMask(mask_prc_fuera)
                    .rename("area_fueraPRC"),
                ]
            )
        )
        areas_prc = hu_prc.map(
            lambda image: image.select(["area_dentroPRC", "area_fueraPRC"])
            .reduceRegions(collection=table, reducer=ee.Reducer.sum(), scale=10)
            .map(
                lambda f: f.set(
                    {
                        "Year": image.get("year"),
                        "Precision_Kappa": ee.Number(0),
                        "Area_DentroPRC": ee.Number(f.get("area_dentroPRC")).format(
                            "%.2f"
                        ),
                        "Area_FueraPRC": ee.Number(f.get("area_fueraPRC")).format(
                            "%.2f"
                        ),
                    }
                )
            )
        ).flatten()

        t2 = ee.batch.Export.table.toDrive(
            collection=areas_prc,
            selectors=["Year", "Area_DentroPRC", "Area_FueraPRC", "Precision_Kappa"],
            description=stem_prc,
            fileNamePrefix="Areas_Huella_Urbana_Yearly",
            folder=paths.DRIVE_HU_YEARLY,
            fileFormat="CSV",
        )
        t2.start()
        tasks.append(t2)

    return tasks
