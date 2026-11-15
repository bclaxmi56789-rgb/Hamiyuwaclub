/**
 * Shared map style configuration for all Leaflet maps in the app.
 *
 * Uses OpenFreeMap Liberty (vector tiles via MapLibre GL) as the default,
 * with CartoDB Voyager, ESRI Satellite and OSM as fallback / alternative layers.
 *
 * Import the worker-URL fix once here so every consumer gets it automatically.
 */
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

if (typeof window !== "undefined") {
  try {
    setWorkerUrl(workerUrl);
  } catch (e) {
    console.warn("Could not set maplibre worker url:", e);
  }
}

export type MapStyleKey =
  | "osm"
  | "voyager"
  | "satellite_hybrid"
  | "satellite"
  | "liberty"
  | "dark";

export interface MapStyleConfig {
  label: string;
  category: "street" | "satellite";
  type: "vector" | "raster" | "hybrid";
  url: string;
  overlayUrl?: string;
  subdomains?: string[];
  maxZoom?: number;
  isRetina?: boolean;
}

export const DEFAULT_MAP_STYLE: MapStyleKey = "osm";

export const MAP_STYLES: Record<MapStyleKey, MapStyleConfig> = {
  osm: {
    label: "🌐 OpenStreetMap (क्लासिक)",
    category: "street",
    type: "raster",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
  },
  voyager: {
    label: "🗺️ आधुनिक सडक (CartoDB Voyager HD)",
    category: "street",
    type: "raster",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: ["a", "b", "c", "d"],
    maxZoom: 20,
    isRetina: true,
  },
  satellite_hybrid: {
    label: "🛰️ स्याटेलाइट + सडक नाम (Hybrid)",
    category: "satellite",
    type: "hybrid",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    overlayUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
  },
  satellite: {
    label: "🛰️ स्याटेलाइट फोटो मात्र (Satellite)",
    category: "satellite",
    type: "raster",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
  },
  liberty: {
    label: "🗽 OpenFreeMap Liberty (Vector)",
    category: "street",
    type: "vector",
    url: "https://tiles.openfreemap.org/styles/liberty",
  },
  dark: {
    label: "🌑 गाढा नक्सा (OpenFreeMap Dark)",
    category: "street",
    type: "vector",
    url: "https://tiles.openfreemap.org/styles/dark",
  },
};

/** Shared style-selector groups for <select> dropdowns */
export const MAP_STYLE_GROUPS: Array<{
  label: string;
  keys: MapStyleKey[];
}> = [
  {
    label: "🗺️ सडक नक्सा",
    keys: ["osm", "voyager", "liberty", "dark"],
  },
  {
    label: "🛰️ स्याटेलाइट",
    keys: ["satellite_hybrid", "satellite"],
  },
];

