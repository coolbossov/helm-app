import type { ContactMarkerData } from "@/types";

interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in km between two points */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Minimum distance in km from a point to the line segment start→end.
 * Projects point onto the segment and clamps to [0,1].
 */
function pointToSegmentKm(point: LatLng, start: LatLng, end: LatLng): number {
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  if (dx === 0 && dy === 0) return haversineKm(point, start);

  let t =
    ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) /
    (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const proj: LatLng = {
    lat: start.lat + t * dy,
    lng: start.lng + t * dx,
  };
  return haversineKm(point, proj);
}

/**
 * Filter contacts within `radiusKm` of the line segment start→end.
 * Returns contacts sorted by their projection position along the segment.
 */
export function contactsInCorridor(
  contacts: ContactMarkerData[],
  start: LatLng,
  end: LatLng,
  radiusKm = 8
): ContactMarkerData[] {
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;

  return contacts
    .map((c) => {
      const p: LatLng = { lat: c.latitude, lng: c.longitude };
      const dist = pointToSegmentKm(p, start, end);
      // projection parameter for sorting along the route
      const t =
        dx === 0 && dy === 0
          ? 0
          : ((p.lng - start.lng) * dx + (p.lat - start.lat) * dy) /
            (dx * dx + dy * dy);
      return { contact: c, dist, t };
    })
    .filter((item) => item.dist <= radiusKm)
    .sort((a, b) => a.t - b.t)
    .map((item) => item.contact);
}
