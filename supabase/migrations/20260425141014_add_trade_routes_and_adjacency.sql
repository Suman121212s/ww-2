/*
  # Trade Routes & Province Adjacency

  ## Overview
  Adds infrastructure for trade routes between countries, air/road route paths,
  and province adjacency data for better pathfinding and boundary visualization.

  ## New Tables

  ### trade_routes
  - Links between countries for trade connectivity
  - Supports both air routes (straight line) and road routes (curved/pathfinding)
  - Distance-based logistics similar to resource transfers
  - Status tracking: active, inactive, blocked (for warfare)

  ### route_paths
  - Stores pre-computed GeoJSON paths for air and road routes
  - Air routes: straight line between country capitals
  - Road routes: curved paths following coastlines and terrain (simplified)

  ### provinces_adjacency
  - Caches adjacent provinces for rebellion checks and boundary rendering
  - Stores as jsonb array for efficient queries

  ## Modified Tables

  ### provinces
  - boundary_coords jsonb for rendering province boundaries as dotted lines
  - connected_to_capital boolean for trade flow optimization

  ## Indexes & Performance
  - Indexes on trade_routes for status and country lookups
  - Indexes on route_paths for visualization queries
*/

-- =========================================
-- TRADE ROUTES
-- =========================================
CREATE TABLE IF NOT EXISTS trade_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_country_id uuid REFERENCES countries(id) ON DELETE CASCADE,
  to_country_id uuid REFERENCES countries(id) ON DELETE CASCADE,
  route_type text NOT NULL DEFAULT 'air' CHECK (route_type IN ('air', 'road', 'maritime')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked', 'damaged')),
  distance_km numeric NOT NULL DEFAULT 0,
  travel_days numeric NOT NULL DEFAULT 1,
  goods_capacity numeric NOT NULL DEFAULT 100,
  goods_in_transit numeric NOT NULL DEFAULT 0,
  toll_rate numeric NOT NULL DEFAULT 0.05,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trade_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trade routes"
  ON trade_routes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage routes"
  ON trade_routes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update routes"
  ON trade_routes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =========================================
-- ROUTE PATHS (GeoJSON storage)
-- =========================================
CREATE TABLE IF NOT EXISTS route_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_route_id uuid REFERENCES trade_routes(id) ON DELETE CASCADE,
  route_type text NOT NULL CHECK (route_type IN ('air', 'road')),
  coordinates jsonb NOT NULL, -- GeoJSON LineString coordinates
  length_km numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE route_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read route paths"
  ON route_paths FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage paths"
  ON route_paths FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =========================================
-- PROVINCES ADJACENCY CACHE
-- =========================================
CREATE TABLE IF NOT EXISTS provinces_adjacency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid REFERENCES provinces(id) ON DELETE CASCADE UNIQUE,
  adjacent_province_ids jsonb NOT NULL DEFAULT '[]',
  adjacent_countries jsonb NOT NULL DEFAULT '[]',
  boundary_distance_km numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE provinces_adjacency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read adjacency"
  ON provinces_adjacency FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage adjacency"
  ON provinces_adjacency FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update adjacency"
  ON provinces_adjacency FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =========================================
-- ADD BOUNDARY COORDS TO PROVINCES
-- =========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provinces' AND column_name = 'boundary_coords'
  ) THEN
    ALTER TABLE provinces ADD COLUMN boundary_coords jsonb DEFAULT '[]';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provinces' AND column_name = 'connected_to_capital'
  ) THEN
    ALTER TABLE provinces ADD COLUMN connected_to_capital boolean DEFAULT false;
  END IF;
END $$;

-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX IF NOT EXISTS idx_trade_routes_from ON trade_routes(from_country_id);
CREATE INDEX IF NOT EXISTS idx_trade_routes_to ON trade_routes(to_country_id);
CREATE INDEX IF NOT EXISTS idx_trade_routes_status ON trade_routes(status);
CREATE INDEX IF NOT EXISTS idx_route_paths_trade_route ON route_paths(trade_route_id);
CREATE INDEX IF NOT EXISTS idx_provinces_adjacency_province ON provinces_adjacency(province_id);
