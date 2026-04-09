"""
GUÍA RÁPIDA DE AUDIT TERMINAL - pipeline.py
============================================

EMOJIS Y SÍMBOLOS EN LA TERMINAL:
=================================

INICIO:
  📁 = Verificando Google Drive para evitar duplicados
  ⏭️  = Saltando un paso (ej: --skip-drive-preflight)

ENCOLADO (CLOUDAGE A EARTH ENGINE):
  📤 = Tareas encoladas en Earth Engine
  ✓  = Confirmación/éxito

ESPERA:
  ⏳ = Esperando que terminen las tareas en EE
  ℹ️  = Información general

DESCARGA:
  ⬇️  = Descargando desde Drive al repositorio local
  📥 = En proceso de descarga
  🔄 = Reemplazando archivos locales (sincronización completa)
  🔄 = Espejo completo: archivos en Drive reemplazan los locales

PROCESAMIENTO:
  🔄 = Procesando producto (inicio)

RESULTADO:
  ✓  = Completado exitosamente


QUÉ SIGNIFICA CADA LÍNEA:
=========================

[NDVI] Estado: Hay meses nuevos para derivados
  → Hay datos nuevos en Earth Engine desde el último procesamiento

[NDVI] Cobertura máxima: 2026-03
  → Los datos en EE llegan hasta marzo 2026

[NDVI] Nada que descargar
  → No hay cambios nuevos, todo está actualizado localmente

[NDVI] Descargando: ndvi_raster_monthly, ndvi_csv_yearly
  → Se descargarán rasters mensuales y CSVs anuales del producto NDVI

✓ [NDVI] Descarga completada
  → El producto NDVI fue sincronizado exitosamente


PRODUCTOS DISPONIBLES:
======================

  NDVI   = Índice de Vegetación (Sentinel-2)
  AOD    = Profundidad Óptica del Aerosol (MODIS)
  NO2    = Dióxido de Nitrógeno (Sentinel-5P)
  SO2    = Dióxido de Azufre (Sentinel-5P)
  LST    = Temperatura Superficial del Terreno (Landsat-8)


EJEMPLOS DE USO:
================

# Ejecutar todos (NDVI, AOD, NO2, SO2, LST):
python pipeline.py

# Solo un producto:
python pipeline.py --product ndvi
python pipeline.py --product aod

# Sin esperar a tareas completen:
python pipeline.py --skip-wait

# Sin verificar Drive (más rápido, pero puede duplicar):
python pipeline.py --skip-drive-preflight

# Solo encolar, no descargar:
python pipeline.py --enqueue-only

# Solo descargar (debe haber tareas completadas en Drive):
python pipeline.py --download-only

# Ver ayuda completa:
python pipeline.py --help
"""
