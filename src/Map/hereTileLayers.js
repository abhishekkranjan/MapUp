import * as L from 'leaflet'

const HereTileLayers = {}

// 🍂class TileLayer.HERE
// Tile layer for HERE maps tiles.
HereTileLayers.HERE = L.TileLayer.extend({
  options: {
    subdomains: '1234',
    minZoom: 2,
    maxZoom: 18,

    // 🍂option scheme: String = 'normal.day'
    // The "map scheme", as documented in the HERE API.
    scheme: 'normal.day',

    // 🍂option resource: String = 'maptile'
    // The "map resource", as documented in the HERE API.
    resource: 'maptile',

    // 🍂option mapId: String = 'newest'
    // Version of the map tiles to be used, or a hash of an unique map
    mapId: 'newest',

    // 🍂option format: String = 'png8'
    // Image format to be used (`png8`, `png`, or `jpg`)
    format: 'png8',

    // 🍂option appId: String = ''
    // Required option. The `app_id` provided as part of the HERE credentials
    appId: '',

    // 🍂option appCode: String = ''
    // Required option. The `app_code` provided as part of the HERE credentials
    appCode: ''
  },

  initialize: function initialize(options) {
    options = L.setOptions(this, options)

    // Decide if this scheme uses the aerial servers or the basemap servers
    const schemeStart = options.scheme.split('.')[0]
    options.tileResolution = 256

    if (L.Browser.retina) {
      options.tileResolution = 512
    }

    //    {Base URL}{Path}/{resource (tile type)}/{map id}/{scheme}/{zoom}/{column}/{row}/{size}/{format}
    //    ?app_id={YOUR_APP_ID}
    //    &app_code={YOUR_APP_CODE}
    //    &{param}={value}

    const path =
      '/{resource}/2.1/{resource}/{mapId}/{scheme}/{z}/{x}/{y}/{tileResolution}/{format}?app_id={appId}&app_code={appCode}'
    const attributionPath =
      '/maptile/2.1/copyright/{mapId}?app_id={appId}&app_code={appCode}'

    let tileServer = 'base.maps.api.here.com'
    if (
      // eslint-disable-next-line
      schemeStart == 'satellite' ||
      // eslint-disable-next-line
      schemeStart == 'terrain' ||
      // eslint-disable-next-line
      schemeStart == 'hybrid'
    ) {
      tileServer = 'aerial.maps.api.here.com'
    }
    if (options.scheme.indexOf('.traffic.') !== -1) {
      tileServer = 'traffic.maps.api.here.com'
    }

    const tileUrl = 'https://{s}.' + tileServer + path

    this._attributionUrl = L.Util.template(
      'https://1.' + tileServer + attributionPath,
      this.options
    )

    L.TileLayer.prototype.initialize.call(this, tileUrl, options)

    this._attributionText = ''
  },

  onAdd: function onAdd(map) {
    L.TileLayer.prototype.onAdd.call(this, map)

    if (!this._attributionBBoxes) {
      this._fetchAttributionBBoxes()
    }
  },

  onRemove: function onRemove(map) {
    L.TileLayer.prototype.onRemove.call(this, map)

    this._map.attributionControl.removeAttribution(this._attributionText)

    this._map.off('moveend zoomend resetview', this._findCopyrightBBox, this)
  },

  _fetchAttributionBBoxes: function _onMapMove() {
    const xmlhttp = new XMLHttpRequest()
    xmlhttp.onreadystatechange = L.bind(function() {
      // eslint-disable-next-line
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        this._parseAttributionBBoxes(JSON.parse(xmlhttp.responseText))
      }
    }, this)
    xmlhttp.open('GET', this._attributionUrl, true)
    xmlhttp.send()
  },

  _parseAttributionBBoxes: function _parseAttributionBBoxes(json) {
    if (!this._map) {
      return
    }
    const providers = json[this.options.scheme.split('.')[0]] || json.normal
    for (let i = 0; i < providers.length; i++) {
      if (providers[i].boxes) {
        for (let j = 0; j < providers[i].boxes.length; j++) {
          const box = providers[i].boxes[j]
          providers[i].boxes[j] = L.latLngBounds([
            [box[0], box[1]],
            [box[2], box[3]]
          ])
        }
      }
    }

    this._map.on('moveend zoomend resetview', this._findCopyrightBBox, this)

    this._attributionProviders = providers

    this._findCopyrightBBox()
  },

  _findCopyrightBBox: function _findCopyrightBBox() {
    if (!this._map) {
      return
    }
    const providers = this._attributionProviders
    const visibleProviders = []
    const zoom = this._map.getZoom()
    const visibleBounds = this._map.getBounds()

    for (let i = 0; i < providers.length; i++) {
      if (providers[i].minLevel < zoom && providers[i].maxLevel > zoom) {
        if (!providers[i].boxes) {
          // No boxes = attribution always visible
          visibleProviders.push(providers[i])
          break
        }
      }

      for (let j = 0; j < providers[i].boxes.length; j++) {
        const box = providers[i].boxes[j]
        if (visibleBounds.overlaps(box)) {
          visibleProviders.push(providers[i])
          break
        }
      }
    }

    const attributions = [
      '<a href="https://legal.here.com/terms/serviceterms/gb/">HERE maps</a>'
    ]
    // eslint-disable-next-line
    for (let i = 0; i < visibleProviders.length; i++) {
      const provider = visibleProviders[i]
      attributions.push(
        '<abbr title="' + provider.alt + '">' + provider.label + '</abbr>'
      )
    }

    const attributionText = '© ' + attributions.join(', ') + '. '

    if (attributionText !== this._attributionText) {
      this._map.attributionControl.removeAttribution(this._attributionText)
      this._map.attributionControl.addAttribution(
        (this._attributionText = attributionText)
      )
    }
  }
})

HereTileLayers.here = function(opts) {
  return new HereTileLayers.HERE(opts)
}

export default HereTileLayers
