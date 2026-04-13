"""
Huella Urbana classification from Sentinel-1 GRD + Sentinel-2 SR Harmonized.

Translates the JS code from ``clean_class.txt`` into the Python GEE API.
Training: 2018 data with existing training points.
Classification: one image per year (2019 onward), exported to Drive.
"""
from __future__ import annotations

import ee

from ...config import paths
from ...drive.drive_export_gate import DriveExportGate


# ── Vector assets ──────────────────────────────────────────────────────────
AOI_UPLA = "users/plataformagenius/Vectores/Division_Administrativa/Comuna_Quilpue2017"
DISTRITOS_URBANOS = "users/plataformagenius/Vectores/Division_Administrativa/Distritos_Urbanos"
PRC_QUILPUE = "users/plataformagenius/Vectores/Division_Administrativa/PRC_Quilpue"
TRAINING_POINTS = "projects/ee-franciscagutierrez-cmm/assets/training-sample-3857float"
VALIDATION_SAMPLE = "projects/ee-franciscagutierrez-cmm/assets/validacion_30_quilpue"

CLASS_PROPERTY = "CID"
OPTICAL_BANDS = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B8A", "B11", "B12"]


def _aoi() -> ee.FeatureCollection:
    return ee.FeatureCollection(AOI_UPLA)


def _radar_stack(
    start_date: str,
    end_date: str,
    orbit_pass: str,
    suffix: str,
    aoi: ee.FeatureCollection,
) -> ee.Image:
    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(aoi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .filter(ee.Filter.eq("orbitProperties_pass", orbit_pass))
    )
    s1_median = s1.median().clip(aoi)
    vv = s1_median.select("VV").rename(f"VV_{suffix}")
    vh = s1_median.select("VH").rename(f"VH_{suffix}")
    ratio = vv.subtract(vh).rename(f"Ratio_{suffix}")
    return vv.addBands(vh).addBands(ratio)


def _train_rf_model(aoi: ee.FeatureCollection) -> ee.Classifier:
    """Train a Random Forest on Nov-Dec 2018 S1+S2 composite."""
    stack_d = _radar_stack("2018-11-01", "2018-12-31", "DESCENDING", "D", aoi)
    stack_a = _radar_stack("2018-11-01", "2018-12-31", "ASCENDING", "A", aoi)

    s2_2018 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate("2018-11-01", "2018-12-31")
        .filterBounds(aoi)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
    )
    optical = s2_2018.median().clip(aoi).select(OPTICAL_BANDS)
    stacked = optical.addBands(stack_d).addBands(stack_a)

    training_pts = ee.FeatureCollection(TRAINING_POINTS)
    training_data = stacked.sampleRegions(
        collection=training_pts,
        properties=[CLASS_PROPERTY],
        scale=10,
    )
    return (
        ee.Classifier.smileRandomForest(numberOfTrees=40, variablesPerSplit=6)
        .train(
            features=training_data,
            classProperty=CLASS_PROPERTY,
            inputProperties=stacked.bandNames(),
        )
    )


def _classify_year(
    year: int,
    classifier: ee.Classifier,
    aoi: ee.FeatureCollection,
) -> ee.Image:
    start_date = f"{year}-01-01"
    end_date_optical = f"{year}-03-31"
    end_date_radar = f"{year}-06-30" if year == 2022 else f"{year}-03-31"

    stack_d = _radar_stack(start_date, end_date_radar, "DESCENDING", "D", aoi)
    stack_a = _radar_stack(start_date, end_date_radar, "ASCENDING", "A", aoi)

    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate(start_date, end_date_optical)
        .filterBounds(aoi)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
    )
    optical = s2.median().clip(aoi).select(OPTICAL_BANDS)
    classified = optical.addBands(stack_d).addBands(stack_a).classify(classifier)
    return classified.set("year", year).set(
        "system:time_start", ee.Date.fromYMD(year, 1, 1).millis()
    )


def start_hu_yearly_raster_tasks(
    missing_years: list[int],
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """Classify each missing year and export GeoTIFF to Drive."""
    if not missing_years:
        print("Huella_Urbana: sin años faltantes; nada que exportar.")
        return []
    print(f"Huella_Urbana: {len(missing_years)} año(s) a clasificar.")

    aoi = _aoi()
    region = aoi.geometry()
    classifier = _train_rf_model(aoi)
    tasks: list[ee.batch.Task] = []

    for y in missing_years:
        stem = f"Huella_Urbana_Yearly_{y}"
        if (
            drive_gate
            and drive_gate.should_skip_export(
                paths.DRIVE_HU_YEARLY, stem, (".tif", ".tiff")
            )
        ):
            continue
        classified = _classify_year(y, classifier, aoi)
        t = ee.batch.Export.image.toDrive(
            image=classified,
            description=stem,
            folder=paths.DRIVE_HU_YEARLY,
            fileNamePrefix=stem,
            scale=10,
            region=region,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks
