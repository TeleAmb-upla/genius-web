"""
CSV exports for Huella Urbana.
Leer de arriba abajo (estilo Earth Engine Code Editor). API estable vía ``../csv_tasks.py``.
"""
from __future__ import annotations

import ee

from ....config import paths
from ....drive.drive_export_gate import DriveExportGate
from .. import raster_tasks as rt

# Larger tileScale speeds up zonal reducers on Earth Engine.
_AREA_TILE_SCALE = 4
_AREA_MAX_PIXELS = int(1e10)


def _hu_asset_covers_years(years: list[int]) -> bool:
    """True if the yearly HU ImageCollection has exactly one image per requested year."""
    uniq = sorted(set(years))
    if not uniq:
        return False
    try:
        ic = ee.ImageCollection(paths.ASSET_HU_YEARLY).filter(
            ee.Filter.inList("year", uniq)
        )
        return int(ic.size().getInfo()) == len(uniq)
    except Exception:
        return False


def _col_hu_from_asset(years: list[int]) -> ee.ImageCollection:
    """Build col_hu (pixel_area + kappa) from existing asset images (fast path)."""
    uniq = sorted(set(years))
    ic = (
        ee.ImageCollection(paths.ASSET_HU_YEARLY)
        .filter(ee.Filter.inList("year", uniq))
        .sort("year")
    )

    def add_kappa(img: ee.Image) -> ee.Image:
        img = ee.Image(img)
        return img.set("kappa", rt._validation_kappa(img))

    with_kappa = ic.map(add_kappa)

    def add_pixel_area(image: ee.Image) -> ee.Image:
        image = ee.Image(image)
        cls = image.select(["classification"])
        return image.addBands(
            ee.Image.pixelArea()
            .divide(10000)
            .updateMask(cls.eq(1))
            .rename("pixel_area")
        )

    return with_kappa.map(add_pixel_area)


def _col_hu_from_classify(
    years: list[int],
    aoi: ee.FeatureCollection,
    classifier: ee.Classifier,
) -> ee.ImageCollection:
    """Full reclassification per year (slow; used when asset is incomplete)."""
    images = [rt.classify_year_with_kappa(y, classifier, aoi) for y in years]

    def add_pixel_area(image: ee.Image) -> ee.Image:
        image = ee.Image(image)
        cls = image.select(["classification"])
        return image.addBands(
            ee.Image.pixelArea()
            .divide(10000)
            .updateMask(cls.eq(1))
            .rename("pixel_area")
        )

    return ee.ImageCollection.fromImages(images).map(add_pixel_area)


def _yearly_stats_fc(
    col_hu: ee.ImageCollection,
    aoi: ee.FeatureCollection,
    prc: ee.FeatureCollection,
    table: ee.FeatureCollection,
) -> ee.FeatureCollection:
    """
    One Feature per year: all CSV columns. Both Drive exports select subsets of this FC
    so Earth Engine shares one evaluation graph.
    """
    mask_prc_dentro = ee.Image.constant(1).clip(prc).mask()
    mask_prc_fuera = mask_prc_dentro.Not()
    geom = aoi.geometry()

    def row_for_image(image: ee.Image) -> ee.Feature:
        image = ee.Image(image)
        pa = image.select("pixel_area")
        stacked = pa.updateMask(mask_prc_dentro).rename("area_dentroPRC").addBands(
            pa.updateMask(mask_prc_fuera).rename("area_fueraPRC")
        )
        ha = (
            image.select("pixel_area")
            .reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=geom,
                scale=10,
                maxPixels=_AREA_MAX_PIXELS,
                tileScale=_AREA_TILE_SCALE,
            )
            .get("pixel_area")
        )
        pr = stacked.reduceRegions(
            collection=table,
            reducer=ee.Reducer.sum(),
            scale=10,
            tileScale=_AREA_TILE_SCALE,
        )
        f0 = ee.Feature(pr.first())
        return ee.Feature(
            None,
            {
                "Year": image.get("year"),
                "Hectareas": ee.Number(ha).format("%.2f"),
                "Area_DentroPRC": ee.Number(f0.get("area_dentroPRC")).format("%.2f"),
                "Area_FueraPRC": ee.Number(f0.get("area_fueraPRC")).format("%.2f"),
                "Precision_Kappa": ee.Number(image.get("kappa")).format("%.4f"),
            },
        )

    return col_hu.map(row_for_image)


def start_hu_csv_tasks(
    years: list[int],
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """Build the Huella Urbana collection for ``years`` and export CSV stats."""
    if not years:
        return []

    aoi = rt._aoi()
    prc = ee.FeatureCollection(rt.PRC_QUILPUE)
    table = aoi

    if _hu_asset_covers_years(years):
        print(
            "Huella_Urbana CSV: usando imágenes en asset GEE (solo kappa + sumas; más rápido)."
        )
        col_hu = _col_hu_from_asset(years)
    else:
        print(
            "Huella_Urbana CSV: asset incompleto o no disponible; reclasificando años (lento)."
        )
        classifier = rt._train_rf_model(aoi)
        col_hu = _col_hu_from_classify(years, aoi, classifier)

    stats_fc = _yearly_stats_fc(col_hu, aoi, prc, table)

    tasks: list[ee.batch.Task] = []

    stem_total = "Huella_Urbana_Anual"
    if not (
        drive_gate
        and drive_gate.should_skip_export(paths.DRIVE_HU_YEARLY, stem_total, (".csv",))
    ):
        triplets = stats_fc.select(["Year", "Hectareas"])
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

    stem_prc = "Areas_Huella_Urbana_Yearly"
    if not (
        drive_gate
        and drive_gate.should_skip_export(paths.DRIVE_HU_YEARLY, stem_prc, (".csv",))
    ):
        prc_tbl = stats_fc.select(
            ["Year", "Area_DentroPRC", "Area_FueraPRC", "Precision_Kappa"]
        )
        t2 = ee.batch.Export.table.toDrive(
            collection=prc_tbl,
            selectors=["Year", "Area_DentroPRC", "Area_FueraPRC", "Precision_Kappa"],
            description=stem_prc,
            fileNamePrefix="Areas_Huella_Urbana_Yearly",
            folder=paths.DRIVE_HU_YEARLY,
            fileFormat="CSV",
        )
        t2.start()
        tasks.append(t2)

    return tasks
