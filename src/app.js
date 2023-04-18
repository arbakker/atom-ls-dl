import * as turf from "@turf/turf";
import * as wellknown from "wellknown";
import "ol/ol.css";
import { Map, View } from "ol";
import WMTSSource from "ol/source/WMTS";
import TileLayer from "ol/layer/Tile.js";
import WMTSTileGrid from "ol/tilegrid/WMTS.js";
import { register } from "ol/proj/proj4.js";
import { fromLonLat } from "ol/proj";
import proj4 from "proj4";
import Projection from "ol/proj/Projection";
import { getTopLeft } from "ol/extent.js";
import WKT from "ol/format/WKT";
import GeoJSON from "ol/format/GeoJSON.js";
import { Vector as VectorSource } from "ol/source.js";
import { Vector as VectorLayer } from "ol/layer.js";
import { Fill, Stroke, Style } from "ol/style.js";

const BRTA_ATTRIBUTION =
  'Kaartgegevens: © <a href="http://www.cbs.nl">CBS</a>, <a href="http://www.kadaster.nl">Kadaster</a>, <a href="http://openstreetmap.org">OpenStreetMap</a><span class="printhide">-auteurs (<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>).</span>';

proj4.defs(
  "EPSG:28992",
  "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs"
);
register(proj4);
const rdProjection = new Projection({
  code: "EPSG:28992",
  extent: [-285401.92, 22598.08, 595401.92, 903401.92],
});

// can be calculated based on resolution z0, written out for clarity
// see https://www.geonovum.nl/uploads/standards/downloads/nederlandse_richtlijn_tiling_-_versie_1.1.pdf
const resolutions = [
  3440.64, 1720.32, 860.16, 430.08, 215.04, 107.52, 53.76, 26.88, 13.44, 6.72,
  3.36, 1.68, 0.84, 0.42, 0.21,
];
const matrixIds = new Array(15);
for (var i = 0; i < 15; ++i) {
  matrixIds[i] = i;
}

function getWmtsLayer(layername) {
  return new TileLayer({
    type: "base",
    title: `${layername} WMTS`,
    extent: rdProjection.extent,
    source: new WMTSSource({
      url: "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0",
      crossOrigin: "Anonymous",
      layer: layername,
      matrixSet: "EPSG:28992",
      format: "image/png",
      attributions: BRTA_ATTRIBUTION,
      projection: rdProjection,
      tileGrid: new WMTSTileGrid({
        origin: getTopLeft(rdProjection.getExtent()),
        resolutions: resolutions,
        matrixIds: matrixIds,
      }),
      style: "default",
    }),
  });
}

const brtGrijsWmtsLayer = getWmtsLayer("grijs");

const map = new Map({
  layers: [brtGrijsWmtsLayer],
  target: "map",
  view: new View({
    center: fromLonLat([5.43, 52.18]),
    zoom: 8,
  }),
});

function getIntersectingBoundingBoxes(wktGeometry, features) {
  // Parse the WKT geometry into a GeoJSON feature
  const searchGeometry = wellknown.parse(wktGeometry);
  // Loop through the list of bounding boxes and check if they intersect the geometry
  const intersectingBoundingBoxes = [];
  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    // Parse the bounding box into a Turf.js polygon feature
    // Check if the bounding box intersects the geometry
    const intersection = turf.intersect(searchGeometry, feature);
    if (intersection !== null) {
      intersectingBoundingBoxes.push(feature);
    }
  }
  return intersectingBoundingBoxes;
}

var lsGeometry = new VectorSource({});
var lsGeometryLayer = new VectorLayer({
  source: lsGeometry,
});

var bboxGeometry = new VectorSource({});
var bboxGeometryLayer = new VectorLayer({
  source: bboxGeometry,
  style: new Style({
    stroke: new Stroke({
      color: "rgba(255, 0, 0, 1)",
      lineDash: [4],
      width: 1,
    }),
    fill: new Fill({
      color: "rgba(0, 255, 98, 0.5)",
    }),
  }),
});
map.addLayer(bboxGeometryLayer);
map.addLayer(lsGeometryLayer);

const LOCATIE_SERVER_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

let query = "";
document.getElementById("lsInput").addEventListener("keyup", (e) => {
  if (query === e.target.value) {
    return;
  }
  query = e.target.value;
  fetch(
    `${LOCATIE_SERVER_URL}/suggest?q=${query}&fq=type:(gemeente OR woonplaats OR provincie)`
  )
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      if (data.response.docs.length > 0) {
        let options = data.response.docs.map(
          (x) => `<option value="${x.weergavenaam}" id="${x.id}">`
        );
        let optionsHtml = options.join("");
        document.getElementById("locatie-auto-complete").innerHTML =
          optionsHtml;
        document.getElementById("buttons").classList.add("hidden");
      }
    });
});
function humanFileSize(bytes, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + " B";
  }

  const units = si
    ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + " " + units[u];
}

function downloadFile(url) {
  // Create a link and set the URL using `createObjectURL`
  const link = document.createElement("a");
  let filename = url.split("/").reverse()[0];
  link.style.display = "none";
  link.id = filename;
  link.href = url;
  link.download = filename;
  link.setAttribute("target", "_blank");
  // It needs to be added to the DOM so it can be clicked
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
}

document.getElementById("copy").addEventListener("click", () => {
  let clipboardText = "";
  bboxGeometryLayer.getSource().forEachFeature(function (feature) {
    let url = feature.getProperties().url;
    clipboardText += `${url}\n`;
  });
  navigator.clipboard.writeText(clipboardText);
});

document.getElementById("download").addEventListener("click", () => {
  bboxGeometryLayer.getSource().forEachFeature(function (feature) {
    let url = feature.getProperties().url;
    downloadFile(url);
    setTimeout(function () {}, 10);
  });
});

function main(bboxFeatureCollection) {
  const vectorSource = new VectorSource({
    features: new GeoJSON().readFeatures(bboxFeatureCollection, {
      dataProjection: "EPSG:28992",
      featureProjection: "EPSG:3857",
    }),
  });
  const vectorLayer = new VectorLayer({
    source: vectorSource,
    style: new Style({
      stroke: new Stroke({
        color: "rgba(210,210,210,0.8)",
        lineDash: [4],
        width: 1,
      }),
    }),
  });
  map.addLayer(vectorLayer);

  document.getElementById("lsInput").addEventListener("input", (event) => {
    if (
      event.inputType === "insertReplacementText" ||
      event.inputType === undefined
    ) {
      const options = document
        .getElementById("locatie-auto-complete")
        .querySelectorAll("option");
      let id = "";
      for (let option of options) {
        if (option.value === event.target.value) {
          id = option.id;
          query = option.value;
        }
      }
      fetch(
        `${LOCATIE_SERVER_URL}/lookup?id=${id}&fl=id,geometrie_ll,geometrie_rd`
      )
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          lsGeometry.clear();
          bboxGeometry.clear();

          const wktLoc = data.response.docs[0].geometrie_ll;
          const format = new WKT();
          const feature = format.readFeature(wktLoc, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
          });
          const ext = feature.getGeometry().getExtent();
          map.getView().fit(ext, { maxZoom: 18, padding: [20, 20, 20, 20] });
          lsGeometry.addFeature(feature);

          const wktRdGeom = data.response.docs[0].geometrie_rd;
          const intersectingBoundingBoxes = getIntersectingBoundingBoxes(
            wktRdGeom,
            bboxFeatureCollection.features
          );
          let bboxFeatures = intersectingBoundingBoxes.map((x) =>
            new GeoJSON().readFeature(x, {
              dataProjection: "EPSG:28992",
              featureProjection: "EPSG:3857",
            })
          );
          bboxGeometry.addFeatures(bboxFeatures);
          let count = bboxGeometryLayer.getSource().getFeatures().length;
          let size = 0;
          bboxGeometryLayer.getSource().forEachFeature(function (feature) {
            size += parseInt(feature.getProperties().length);
          });

          document.getElementById(
            "info"
          ).innerHTML = `${count} kaartbladen<br/>${humanFileSize(size, true)}`;

          document.getElementById("locatie-auto-complete").innerHTML = "";
          document.getElementById("lsInput").blur();
          document.getElementById("buttons").classList.remove("hidden");
          setTimeout(() => {
            // set timeout to account for changing mapsize due to buttons bec0oming visible
            map.getView().fit(bboxGeometryLayer.getSource().getExtent(), {
              maxZoom: 18,
              padding: [20, 20, 20, 20],
            });
          }, 100);
        });
    }
  });
}

fetch(
  "https://service.pdok.nl/rws/ahn/atom/preprod/downloads/dtm_05m/kaartbladindex.json"
)
  .then((response) => response.json())
  .then((data) => {
    main(data);
  });
