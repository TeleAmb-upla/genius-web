# Earth Engine (Python): pipeline multi-producto

## Referencia JS (`scripts/*.txt`) → módulos Python

| Referencia | Producto | Código principal |
|------------|----------|------------------|
| `NDVI_*.txt` | NDVI | `products/ndvi/` |
| `AOD_*.txt` | AOD | `products/atmosphere/aod/` (misma jerarquía que NO2/SO2) |
| `NO2_*.txt` | NO2 | `products/atmosphere/` (`spec`, `tasks_core`, `enqueue`) |
| `SO2_*.txt` | SO2 | `products/atmosphere/` |
| `LST_*.txt` | LST | `products/lst/` |

Lógica compartida: `lib/` (`yearmonth`, `state`, `incremental_plan`, `mk_sen`, `zonal_geojson`). Ajustes NDVI Mann–Kendall/Sen: `products/ndvi/mk_sen_trend.py`.

## Ejecución por fases (recomendado)

1. **Asset + rasters** → espera tareas → `download_drive_to_repo` (claves fase raster).
2. **CSV + GeoJSON** → espera → sync tablas.

Por defecto `python -m scripts.gee.pipeline` hace eso en dos fases por producto. `--single-pass` encola todo junto.

## CLI

- `python -m scripts.gee.pipeline --product ndvi` (default)  
- `--product aod|no2|so2|lst|all` — con `all` el orden es NDVI → AOD → NO2 → SO2 → LST.  
- `--only asset,raster,csv,geojson` — subconjunto de categorías.  
- `--include-yearly` — tendencia raster anual y GeoJSON anuales/tendencia donde aplique.  
- Solo encolar (sin espera ni descarga): `python -m scripts.gee.export_all --product …`

## Sincronización Drive → repo

`python -m scripts.gee.drive.download_drive_to_repo --only <claves>`

Las claves están en `SYNC_REGISTRY` en `download_drive_to_repo.py`. El `--only` del **pipeline** usa categorías (`asset`, `raster`, …); las claves concretas de Drive se derivan de las tareas encoladas o del fallback por categoría.

## Estado incremental (JSON en `scripts/gee/`)

- `ndvi_export_state.json`, `aod_export_state.json`, `no2_export_state.json`, `so2_export_state.json`, `lst_export_state.json` — último año-mes derivado y metadatos de tendencia/climatología según producto.
