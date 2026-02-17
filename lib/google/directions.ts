// Server-side Google Directions API wrapper + route optimization

export interface LatLng {
  lat: number;
  lng: number;
}

export interface OptimizeResult {
  orderedIndices: number[]; // original indices in optimized order
  waypointOrder: number[];  // Google's waypoint_order array (for ≤25 stops)
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  polyline?: string;
}

/**
 * Optimize a list of stops using Google Directions API (for ≤23 middle waypoints)
 * or nearest-neighbor heuristic (for larger lists).
 * mode: "fastest" (default) | "shortest" (minimize distance, avoids highways=true not available in basic, uses same optimize but picks shorter)
 */
export async function optimizeStops(stops: LatLng[], mode: "fastest" | "shortest" = "fastest"): Promise<OptimizeResult> {
  if (stops.length < 2) {
    return {
      orderedIndices: stops.map((_, i) => i),
      waypointOrder: [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
    };
  }

  // "shortest" uses nearest-neighbor distance heuristic; "fastest" uses Google Directions API
  if (mode === "shortest") {
    return optimizeWithNearestNeighbor(stops);
  }

  if (stops.length <= 25) {
    return optimizeWithDirectionsApi(stops, mode);
  }

  return optimizeWithNearestNeighbor(stops);
}

async function optimizeWithDirectionsApi(stops: LatLng[], mode: "fastest" | "shortest" = "fastest"): Promise<OptimizeResult> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_SERVER_KEY not set");

  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1);

  const waypointStr = waypoints.length > 0
    ? `optimize:true|${waypoints.map((w) => `${w.lat},${w.lng}`).join("|")}`
    : "";

  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    key: apiKey,
  });
  if (waypointStr) params.set("waypoints", waypointStr);

  const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  if (json.status !== "OK") {
    // Fall back to nearest-neighbor on API error
    console.warn("Directions API error:", json.status, json.error_message);
    return optimizeWithNearestNeighbor(stops);
  }

  const route = json.routes[0];
  const waypointOrder: number[] = route.waypoint_order ?? [];

  // waypointOrder gives indices into the middle waypoints array.
  // Reconstruct full stop order: [0, ...waypointOrder+1, last]
  const orderedIndices = [
    0,
    ...waypointOrder.map((i: number) => i + 1),
    stops.length - 1,
  ];

  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  for (const leg of route.legs) {
    totalDistanceMeters += leg.distance?.value ?? 0;
    totalDurationSeconds += leg.duration?.value ?? 0;
  }

  return {
    orderedIndices,
    waypointOrder,
    totalDistanceMeters,
    totalDurationSeconds,
    polyline: route.overview_polyline?.points,
  };
}

function optimizeWithNearestNeighbor(stops: LatLng[]): OptimizeResult {
  const n = stops.length;
  const visited = new Array(n).fill(false);
  const orderedIndices: number[] = [0];
  visited[0] = true;

  for (let step = 1; step < n; step++) {
    const current = orderedIndices[orderedIndices.length - 1];
    let nearestDist = Infinity;
    let nearestIdx = -1;

    for (let j = 0; j < n; j++) {
      if (!visited[j]) {
        const d = haversineMeters(stops[current], stops[j]);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = j;
        }
      }
    }

    visited[nearestIdx] = true;
    orderedIndices.push(nearestIdx);
  }

  // Estimate total distance
  let totalDistanceMeters = 0;
  for (let i = 0; i < orderedIndices.length - 1; i++) {
    totalDistanceMeters += haversineMeters(
      stops[orderedIndices[i]],
      stops[orderedIndices[i + 1]]
    );
  }

  return {
    orderedIndices,
    waypointOrder: [],
    totalDistanceMeters,
    totalDurationSeconds: Math.round(totalDistanceMeters / 10), // ~36 km/h avg
  };
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000; // earth radius in meters
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
