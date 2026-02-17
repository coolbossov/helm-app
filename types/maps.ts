export interface MapViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapCenter {
  lat: number;
  lng: number;
}

// San Antonio center coordinates
export const SA_CENTER: MapCenter = {
  lat: 29.4241,
  lng: -98.4936,
};

export const DEFAULT_ZOOM = 11;
export const CLUSTER_MAX_ZOOM = 14;
