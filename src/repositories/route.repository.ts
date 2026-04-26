import { supabase } from '../lib/supabase';
import type { TradeRoute, RoutePath, ProvinceAdjacency } from '../lib/types';

export async function getTradeRoutes(countryId?: string): Promise<TradeRoute[]> {
  let query = supabase.from('trade_routes').select('*');

  if (countryId) {
    query = query.or(`from_country_id.eq.${countryId},to_country_id.eq.${countryId}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getTradeRoutesByCountry(fromCountryId: string, toCountryId: string): Promise<TradeRoute | null> {
  const { data, error } = await supabase
    .from('trade_routes')
    .select('*')
    .or(`and(from_country_id.eq.${fromCountryId},to_country_id.eq.${toCountryId}),and(from_country_id.eq.${toCountryId},to_country_id.eq.${fromCountryId})`)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function createTradeRoute(route: Omit<TradeRoute, 'id' | 'created_at' | 'updated_at'>): Promise<TradeRoute> {
  const { data, error } = await supabase
    .from('trade_routes')
    .insert([route])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTradeRoute(id: string, updates: Partial<TradeRoute>): Promise<TradeRoute> {
  const { data, error } = await supabase
    .from('trade_routes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRoutePaths(tradeRouteId: string): Promise<RoutePath[]> {
  const { data, error } = await supabase
    .from('route_paths')
    .select('*')
    .eq('trade_route_id', tradeRouteId);

  if (error) throw error;
  return data ?? [];
}

export async function createRoutePath(path: Omit<RoutePath, 'id' | 'created_at'>): Promise<RoutePath> {
  const { data, error } = await supabase
    .from('route_paths')
    .insert([path])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProvinceAdjacency(provinceId: string): Promise<ProvinceAdjacency | null> {
  const { data, error } = await supabase
    .from('provinces_adjacency')
    .select('*')
    .eq('province_id', provinceId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function upsertProvinceAdjacency(data: ProvinceAdjacency): Promise<ProvinceAdjacency> {
  const { data: result, error } = await supabase
    .from('provinces_adjacency')
    .upsert([data], { onConflict: 'province_id' })
    .select()
    .single();

  if (error) throw error;
  return result;
}
