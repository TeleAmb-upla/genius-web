#!/usr/bin/env python3
"""
Diagnóstico Landsat LST (misma cadena que ``lst/linear/raster.py``): escenas por mes
y cobertura sobre el área urbana Quilpué para un año vs años de referencia.

Uso (raíz del repo, credenciales EE):

    python -m scripts.gee.tools.diagnose_lst_year_landsat --year 2012
    python -m scripts.gee.tools.diagnose_lst_year_landsat --year 2012 --ref 2009 2010 2011 2013 2014 2015
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

if __name__ == "__main__" and not __package__:
    _repo = Path(__file__).resolve().parents[3]
    _s = str(_repo)
    if _s not in sys.path:
        sys.path.insert(0, _s)
    __package__ = "scripts.gee"

import ee  # noqa: E402

from scripts.gee.earth_engine_init.ee_init import initialize_ee  # noqa: E402
from scripts.gee.earth_engine_init import vectors  # noqa: E402
from scripts.gee.products.lst.linear.raster import _build_lst_landsat_collection  # noqa: E402


def _month_window(y: int, m: int) -> tuple[ee.Date, ee.Date]:
    start = ee.Date.fromYMD(y, m, 1)
    end = start.advance(1, "month")
    return start, end


def monthly_stats(
    landsat_ic: ee.ImageCollection,
    region: ee.Geometry,
    y: int,
    m: int,
    *,
    scale: int = 30,
) -> dict:
    start, end = _month_window(y, m)
    filt = landsat_ic.filterDate(start, end)
    n_scenes = int(filt.size().getInfo())
    urban_area_m2 = float(region.area().getInfo())
    out = {
        "year": y,
        "month": m,
        "n_scenes": n_scenes,
        "urban_area_km2": urban_area_m2 / 1e6,
        "urban_lst_cover_pct": None,
    }
    if n_scenes == 0:
        return out
    composite = filt.median().select("LST_mean").rename("LST_mean").clip(region)
    mask = composite.mask()
    pix_m2 = ee.Image.pixelArea()
    covered_m2 = mask.multiply(pix_m2).reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=region,
        scale=scale,
        maxPixels=1e13,
        tileScale=4,
        bestEffort=True,
    )
    cov = covered_m2.get("LST_mean")
    cov_val = ee.Number(cov).getInfo() if cov is not None else None
    if cov_val is None or urban_area_m2 <= 0:
        return out
    out["urban_lst_cover_pct"] = float(cov_val) / urban_area_m2 * 100.0
    return out


def year_summary(year: int, monthly_rows: list[dict]) -> dict:
    rows = [r for r in monthly_rows if r["year"] == year]
    with_scenes = [r for r in rows if r["n_scenes"] > 0]
    covs = [
        r["urban_lst_cover_pct"]
        for r in with_scenes
        if r["urban_lst_cover_pct"] is not None
    ]
    total_scenes = sum(r["n_scenes"] for r in rows)
    return {
        "year": year,
        "total_scenes": total_scenes,
        "months_with_data": len(with_scenes),
        "mean_urban_cover_pct_when_present": (
            sum(covs) / len(covs) if covs else None
        ),
        "min_urban_cover_pct_when_present": min(covs) if covs else None,
        "max_urban_cover_pct_when_present": max(covs) if covs else None,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Diagnóstico Landsat LST por año (Quilpué urbano).")
    p.add_argument("--year", type=int, default=2012, help="Año objetivo (default: 2012)")
    p.add_argument(
        "--ref",
        type=int,
        nargs="*",
        default=[2009, 2010, 2011, 2013, 2014, 2015],
        help="Años de referencia para comparar totales/medias",
    )
    p.add_argument("--scale", type=int, default=30, help="Escala reduceRegion (m)")
    args = p.parse_args(argv)

    initialize_ee()
    fc = vectors.lst_landsat_region_fc()
    region = fc.geometry()
    landsat = _build_lst_landsat_collection(fc).select("LST_mean")

    target = args.year
    ref_years = sorted(set(args.ref))
    all_years = sorted(set(ref_years + [target]))

    monthly_rows: list[dict] = []
    for y in all_years:
        for m in range(1, 13):
            monthly_rows.append(
                monthly_stats(landsat, region, y, m, scale=args.scale),
            )

    ref_summaries = [year_summary(y, monthly_rows) for y in ref_years]
    tgt_summary = year_summary(target, monthly_rows)

    ref_totals = sorted(s["total_scenes"] for s in ref_summaries)
    ref_covers = [
        s["mean_urban_cover_pct_when_present"]
        for s in ref_summaries
        if s["mean_urban_cover_pct_when_present"] is not None
    ]

    med_total = ref_totals[len(ref_totals) // 2] if ref_totals else None
    med_cover = sorted(ref_covers)[len(ref_covers) // 2] if ref_covers else None

    print("\n=== Landsat LST (colección original filtrada como el pipeline) ===\n")
    print(f"Geometría: área urbana Quilpué | scale reduceRegion = {args.scale} m\n")

    print(f"--- Mes a mes {target} ---")
    for r in monthly_rows:
        if r["year"] != target:
            continue
        cov = r["urban_lst_cover_pct"]
        cov_s = f"{cov:.2f} %" if cov is not None else "—"
        print(f"  {target}-{r['month']:02d}  escenas={r['n_scenes']:3d}  cobertura urbana LST≈{cov_s}")

    print(f"\n--- Resumen anual {target} ---")
    print(f"  Total escenas (suma mensual): {tgt_summary['total_scenes']}")
    print(f"  Meses con ≥1 escena: {tgt_summary['months_with_data']}")
    print(
        "  Media cobertura urbana (solo meses con datos): "
        f"{tgt_summary['mean_urban_cover_pct_when_present']}"
    )

    print("\n--- Referencia (medianas entre años ref) ---")
    print(f"  Años ref: {ref_years}")
    if med_total is not None:
        print(f"  Mediana total escenas/año (ref): {med_total}")
    if med_cover is not None:
        print(f"  Mediana media cobertura urbana mensual (ref): {med_cover:.2f} %")

    print("\n--- Por año (total escenas | meses con datos | media cobertura %) ---")
    for y in all_years:
        s = year_summary(y, monthly_rows)
        mc = s["mean_urban_cover_pct_when_present"]
        mc_s = f"{mc:.2f}" if mc is not None else "—"
        tag = " <-- objetivo" if y == target else ""
        print(
            f"  {y}: escenas={s['total_scenes']:4d}  meses={s['months_with_data']:2d}  "
            f"cover_media={mc_s}{tag}"
        )

    sparse = False
    reasons: list[str] = []
    if med_total is not None and tgt_summary["total_scenes"] < 0.5 * med_total:
        sparse = True
        reasons.append(
            f"total escenas {tgt_summary['total_scenes']} < 50 % mediana ref ({med_total})"
        )
    if (
        med_cover is not None
        and tgt_summary["mean_urban_cover_pct_when_present"] is not None
        and tgt_summary["mean_urban_cover_pct_when_present"] < 0.6 * med_cover
    ):
        sparse = True
        reasons.append(
            "media cobertura urbana mensual claramente inferior a la ref (~60 % umbral)"
        )
    if tgt_summary["months_with_data"] < 8:
        sparse = True
        reasons.append(
            f"pocos meses con datos ({tgt_summary['months_with_data']}; umbral heurístico 8)"
        )

    print("\n--- Juicio automático (heurística; revisar tabla) ---")
    if sparse:
        print(f"  SPARSE: {target} → {'; '.join(reasons)}")
        print(f"  Recomendación: excluir {target} de derivados LST o anular valores.")
        return 2
    print(f"  OK_HEURISTIC: {target} no marca como gravemente inferior a ref.")
    print("  Recomendación: mantener año; corregir solo artefactos puntuales si hace falta.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
