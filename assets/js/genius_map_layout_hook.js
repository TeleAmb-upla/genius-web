/**
 * Explorador / index: tras cambiar de indicador, el contenedor del mapa cambia de tamaño.
 * - Parchea L.map para recordar la última instancia Leaflet.
 * - geniusRunMapLayoutRefresh(type): invalidateSize + fitBounds acorde al ámbito (urbano vs regional).
 */
(function () {
    if (typeof window === "undefined") return;

    if (window.L && typeof L.map === "function" && !L.map.__geniusLayoutPatched) {
        var orig = L.map;
        L.map = function (id, options) {
            var m = orig.apply(this, arguments);
            try {
                window.__GENIUS_LAST_LEAFLET_MAP = m;
            } catch (_e) {
                /* ignore */
            }
            return m;
        };
        L.map.__geniusLayoutPatched = true;
    }

    /** [[latSur, lngOeste], [latNorte, lngEste]] — Quilpué / área urbana */
    var BOUNDS_URBAN = [
        [-33.12, -71.54],
        [-32.97, -71.34],
    ];
    /** Región de raster atmósfera (pixel) */
    var BOUNDS_REGIONAL = [
        [-33.38, -71.82],
        [-32.8, -71.08],
    ];

    function boundsLatLngForType(type) {
        var t = String(type || "");
        if (t === "AOD_P" || t === "NO2_P" || t === "SO2_P") return BOUNDS_REGIONAL;
        return BOUNDS_URBAN;
    }

    function skipAutoFit(type) {
        var t = String(type || "");
        return t === "luminosidad";
    }

    function maplibreBounds(swneLatLng) {
        var sw = swneLatLng[0];
        var ne = swneLatLng[1];
        return [
            [sw[1], sw[0]],
            [ne[1], ne[0]],
        ];
    }

    window.geniusFitBoundsForExplorerType = boundsLatLngForType;
    window.geniusSkipLayoutBoundsFit = skipAutoFit;

    window.geniusRunMapLayoutRefresh = function (type) {
        function run() {
            try {
                var t = type;
                var noFit = skipAutoFit(t);
                var swne = boundsLatLngForType(t);
                var regional = String(t || "").indexOf("_P") !== -1;

                var leaf = window.__GENIUS_LAST_LEAFLET_MAP;
                if (leaf && typeof leaf.invalidateSize === "function") {
                    leaf.invalidateSize({ animate: false });
                }
                if (!noFit && leaf && typeof leaf.fitBounds === "function" && window.L) {
                    leaf.fitBounds(window.L.latLngBounds(swne), {
                        padding: [20, 20],
                        maxZoom: regional ? 12 : 15,
                        animate: false,
                    });
                }

                var cmp = window.compareInstance;
                if (
                    !noFit &&
                    cmp &&
                    cmp._mapA &&
                    cmp._mapB &&
                    typeof cmp._mapA.fitBounds === "function"
                ) {
                    var mb = maplibreBounds(swne);
                    var pad = { top: 28, bottom: 28, left: 28, right: 28 };
                    try {
                        cmp._mapA.resize();
                        cmp._mapB.resize();
                        cmp._mapA.fitBounds(mb, {
                            padding: pad,
                            duration: 0,
                            maxZoom: regional ? 12 : 15,
                        });
                        cmp._mapB.fitBounds(mb, {
                            padding: pad,
                            duration: 0,
                            maxZoom: regional ? 12 : 15,
                        });
                    } catch (_e) {
                        /* mapas aún cargando */
                    }
                }

                var m = window.mapInstance;
                if (m && typeof m.resize === "function" && !m.invalidateSize) {
                    try {
                        m.resize();
                    } catch (_e2) {
                        /* ignore */
                    }
                }
            } catch (err) {
                /* noop */
            }
        }
        setTimeout(run, 120);
        setTimeout(run, 450);
        setTimeout(run, 1100);
    };
})();
