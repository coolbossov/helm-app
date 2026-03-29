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

// San Antonio metro center (general default)
export const SA_CENTER: MapCenter = {
  lat: 29.4241,
  lng: -98.4936,
};

export const DEFAULT_ZOOM = 11;
export const CLUSTER_MAX_ZOOM = 14;

// Home base: 10010 Shetland Gate, San Antonio, TX 78254
export const HOME_BASE: MapCenter = {
  lat: 29.5367,
  lng: -98.70431,
};

export const HOME_BASE_ZOOM = 13;
