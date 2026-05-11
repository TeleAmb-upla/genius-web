/**
 * Evita la selección de texto al arrastrar el control L.Control.SideBySide (slider).
 * Debe cargarse después de leaflet-side-by-side(.min).js.
 */
(function () {
  if (typeof L === 'undefined' || !L.Control || !L.Control.SideBySide) return

  var NS = 'leaflet-sbs-genius-noselect'
  var DOC_CLASS = NS + '-doc'

  function preventSelect (e) {
    e.preventDefault()
  }

  function blockSelect (map) {
    var c = map && map.getContainer()
    if (c) L.DomUtil.addClass(c, NS)
    if (document.documentElement) L.DomUtil.addClass(document.documentElement, DOC_CLASS)
    document.addEventListener('selectstart', preventSelect, true)
  }

  function unblockSelect (map) {
    var c = map && map.getContainer()
    if (c) L.DomUtil.removeClass(c, NS)
    if (document.documentElement) L.DomUtil.removeClass(document.documentElement, DOC_CLASS)
    document.removeEventListener('selectstart', preventSelect, true)
  }

  var proto = L.Control.SideBySide.prototype
  var origGetPosition = proto.getPosition
  var origAdd = proto._addEvents
  var origRemove = proto._removeEvents

  /**
   * En index2 (genius-explorer): divisor centrado en la franja útil del mapa
   * (entre --ge-sidebar-edge-x y el carril de gráficos), no en el 50% bruto del contenedor.
   */
  function readCssPx (docEl, name) {
    var v = getComputedStyle(docEl).getPropertyValue(name).trim()
    if (!v) return NaN
    var n = parseFloat(v)
    return isNaN(n) ? NaN : n
  }

  proto.getPosition = function () {
    if (!document.body.classList.contains('genius-explorer')) {
      return origGetPosition.call(this)
    }
    var map = this._map
    if (!map) return origGetPosition.call(this)
    var w = map.getSize().x
    var rangeValue = parseFloat(this._range.value)
    if (isNaN(rangeValue)) rangeValue = 0.5
    var pad = this.options.padding
    var thumb = this.options.thumbSize
    var offset = (0.5 - rangeValue) * (2 * pad + thumb)

    var docEl = document.documentElement
    var L = readCssPx(docEl, '--ge-sidebar-edge-x')
    if (isNaN(L)) L = 0

    var floatW = readCssPx(docEl, '--ge-float-w')
    if (isNaN(floatW)) floatW = 0
    if (document.body.classList.contains('genius-explorer--charts-collapsed')) {
      floatW = 0
    }
    var rightPad = 14
    var R = w - floatW - rightPad
    if (R <= L + 16) {
      return w * rangeValue + offset
    }
    return L + (R - L) * rangeValue + offset
  }

  proto._addEvents = function () {
    origAdd.call(this)
    var range = this._range
    var map = this._map
    if (!range || !map) return

    var control = this
    var start = L.Browser.touch ? 'touchstart' : 'mousedown'
    var end = L.Browser.touch ? 'touchend' : 'mouseup'

    var onStart = function () {
      if (control._geniusSbsNoSelectActive) return
      control._geniusSbsNoSelectActive = true
      blockSelect(map)
    }

    var onEnd = function () {
      if (!control._geniusSbsNoSelectActive) return
      control._geniusSbsNoSelectActive = false
      unblockSelect(map)
    }

    L.DomEvent.on(range, start, onStart)
    L.DomEvent.on(range, end, onEnd)
    L.DomEvent.on(document, end, onEnd)
    if (L.Browser.touch) {
      L.DomEvent.on(document, 'touchcancel', onEnd)
    }

    this._geniusSbsNoSelectGuard = {
      range: range,
      map: map,
      start: start,
      end: end,
      onStart: onStart,
      onEnd: onEnd
    }

    map.on('resize', this._updateClip, this)
  }

  proto._removeEvents = function () {
    var g = this._geniusSbsNoSelectGuard
    if (g) {
      L.DomEvent.off(g.range, g.start, g.onStart)
      L.DomEvent.off(g.range, g.end, g.onEnd)
      L.DomEvent.off(document, g.end, g.onEnd)
      if (L.Browser.touch) {
        L.DomEvent.off(document, 'touchcancel', g.onEnd)
      }
      this._geniusSbsNoSelectActive = false
      unblockSelect(g.map)
      if (g.map) {
        g.map.off('resize', this._updateClip, this)
      }
      this._geniusSbsNoSelectGuard = null
    }
    origRemove.call(this)
  }
})()
