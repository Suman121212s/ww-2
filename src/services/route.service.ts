import * as routeRepo from '../repositories/route.repository';
import { haversineKm } from '../utils/distance';
import type { Country, Province, TradeRoute, RoutePath } from '../lib/types';

// Generate air route: straight line between capitals
export function generateAirRoute(from: Province, to: Province, distKm: number): [number, number][] {
  const steps = Math.ceil(distKm / 100); // One point every 100km
  const coords: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + (to.lng - from.lng) * t;
    coords.push([lng, lat]);
  }

  return coords;
}

// Generate road route: curved path with slight elevation (simulated)
export function generateRoadRoute(from: Province, to: Province, distKm: number): [number, number][] {
  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;

  // Curve factor: create a bezier-like curve
  const curve = distKm / 1000; // Curve intensity based on distance
  const perpLat = (to.lng - from.lng) * curve * 0.001;
  const perpLng = -(to.lat - from.lat) * curve * 0.001;

  const steps = Math.ceil(distKm / 50); // Finer resolution for roads
  const coords: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const base_lng = from.lng + (to.lng - from.lng) * t;
    const base_lat = from.lat + (to.lat - from.lat) * t;

    // Add curvature using quadratic interpolation
    const curveAmount = Math.sin(t * Math.PI) * 0.5;
    const lat = base_lat + perpLat * curveAmount;
    const lng = base_lng + perpLng * curveAmount;

    coords.push([lng, lat]);
  }

  return coords;
}

export async function createTradeRoute(
  fromCountry: Country,
  toCountry: Country,
  fromCapital: Province,
  toCapital: Province,
  type: 'air' | 'road' = 'air'
): Promise<TradeRoute> {
  const distKm = haversineKm(fromCapital.lat, fromCapital.lng, toCapital.lat, toCapital.lng);
  const travelDays = type === 'air' ? Math.ceil(distKm / 1000) : Math.ceil(distKm / 500);

  const route = await routeRepo.createTradeRoute({
    from_country_id: fromCountry.id,
    to_country_id: toCountry.id,
    route_type: type,
    status: 'active',
    distance_km: distKm,
    travel_days: travelDays,
    goods_capacity: 100,
    goods_in_transit: 0,
    toll_rate: 0.05,
  });

  // Generate and store the path
  const coords = type === 'air'
    ? generateAirRoute(fromCapital, toCapital, distKm)
    : generateRoadRoute(fromCapital, toCapital, distKm);

  await routeRepo.createRoutePath({
    trade_route_id: route.id,
    route_type: type,
    coordinates: coords as any,
    length_km: distKm,
  });

  return route;
}

export function getRouteCoordinatesPath(coords: [number, number][]): string {
  return coords.map(([lng, lat], i) => {
    const x = ((lng + 180) / 360) * 1400;
    const y = ((90 - lat) / 180) * 700;
    return `${x},${y}`;
  }).join(' ');
}

export async function calculateProvinceAdjacency(province: Province, allProvinces: Province[]): Promise<string[]> {
  // Find adjacent provinces within 500km
  const ADJACENCY_THRESHOLD = 500; // km

  const adjacent = allProvinces
    .filter((p) => {
      if (p.id === province.id) return false;
      const dist = haversineKm(province.lat, province.lng, p.lat, p.lng);
      return dist <= ADJACENCY_THRESHOLD;
    })
    .map((p) => p.id);

  return adjacent;
}
