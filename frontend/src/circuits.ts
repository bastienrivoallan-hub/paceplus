export type Coord = { latitude: number; longitude: number };

export type Circuit = {
  id: string;
  name: string;
  color: string;
  distance_km: number;
  coords: Coord[];
};

const KM_PER_DEG_LAT = 111.32;

function haversineKm(a: Coord, b: Coord) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const VARIANTS = [
  { name: "Boucle Nord", color: "#5FD86E", bearing: 0 },
  { name: "Boucle Sud-Est", color: "#5B8DEF", bearing: 120 },
  { name: "Boucle Ouest", color: "#E8A13C", bearing: 240 },
];

/** Generate organic-looking running loops starting/ending at the user position. */
export function generateCircuits(start: Coord, distanceKm: number): Circuit[] {
  return VARIANTS.map((v, idx) => {
    const bearing = ((v.bearing + (Math.random() * 30 - 15)) * Math.PI) / 180;
    const coords = generateLoop(start, distanceKm, bearing, idx + 1);
    return { id: `c${idx}`, name: v.name, color: v.color, distance_km: distanceKm, coords };
  });
}

function generateLoop(start: Coord, distanceKm: number, bearingRad: number, seed: number): Coord[] {
  const N = 48;
  const r = distanceKm / (2 * Math.PI); // km
  const latCos = Math.cos((start.latitude * Math.PI) / 180) || 1e-6;
  const center = {
    latitude: start.latitude + (r * Math.cos(bearingRad)) / KM_PER_DEG_LAT,
    longitude: start.longitude + (r * Math.sin(bearingRad)) / (KM_PER_DEG_LAT * latCos),
  };
  const phi0 = bearingRad + Math.PI; // angle from center back to the start point
  const a1 = 0.14 + 0.05 * Math.sin(seed * 7);
  const a2 = 0.09 + 0.04 * Math.cos(seed * 3);

  const pts: Coord[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 2 * Math.PI;
    const phi = phi0 + t;
    const rr = r * (1 + a1 * Math.sin(3 * t) + a2 * Math.sin(5 * t));
    pts.push({
      latitude: center.latitude + (rr * Math.cos(phi)) / KM_PER_DEG_LAT,
      longitude: center.longitude + (rr * Math.sin(phi)) / (KM_PER_DEG_LAT * latCos),
    });
  }

  // Scale so the loop length matches the requested distance…
  let per = 0;
  for (let i = 1; i < pts.length; i++) per += haversineKm(pts[i - 1], pts[i]);
  const k = per > 0 ? distanceKm / per : 1;
  const scaled = pts.map((p) => ({
    latitude: center.latitude + (p.latitude - center.latitude) * k,
    longitude: center.longitude + (p.longitude - center.longitude) * k,
  }));
  // …then translate so the loop starts exactly at the user position.
  const dLat = start.latitude - scaled[0].latitude;
  const dLon = start.longitude - scaled[0].longitude;
  return scaled.map((p) => ({ latitude: p.latitude + dLat, longitude: p.longitude + dLon }));
}
