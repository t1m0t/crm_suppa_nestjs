# Intro

This file details the steps to install postGIS server to serve maps to a web client

# Docker side

1. Build the image
   From this folder: `docker build -t postgres-17-postgis .`
2. Deploy locally with docker compose
   From this folder: `docker compose -f docker-compose.yml up -d`

# Importing pbf map file

1. Download the pbf file from [openstreetmap](https://download.geofabrik.de/asia/india.html)
2. Install osm2pgsql so that we can import the pbf file
   `sudo apt update && sudo apt install osm2pgsql`
3. Create the database
   `psql -U postgres -h localhost`
   then in psql:
   `create database punjab_map;`
4. Activate the extensions for the database
   Still in psql, connect to the database with `\c punjab_map`
   Then:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS hstore;
```

5. Run this command to import
   `osm2pgsql -d <database> -U <user> -W -H localhost path/where/the/file/is/map.pbf`

# Cache table setup

Still in `punjab_map` with `\c punjab_map`

```sql
-- Create cache table
CREATE TABLE IF NOT EXISTS tile_cache (
  cache_key VARCHAR(255) PRIMARY KEY,
  tile_data BYTEA NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP DEFAULT NOW()
);

-- Create index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_tile_cache_expires ON tile_cache(expires_at);

-- Create index for access patterns
CREATE INDEX IF NOT EXISTS idx_tile_cache_accessed ON tile_cache(last_accessed);

CREATE INDEX idx_tile_cache_key_expires ON tile_cache(cache_key, expires_at);
CREATE INDEX idx_tile_cache_hitcount ON tile_cache(hit_count DESC);

-- Optional: Create function to auto-delete expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM tile_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

# Use of pg_tileserv

pg_tileserv runs in its own service. It is not called directly by the client (if not stated otherwise)

`pg_tileserv <= nestjsapp <= client`

## Create a view for excluding points we don't need

```sql
CREATE OR REPLACE VIEW public.v_osm_points_pinds
AS SELECT osm_id,
    name,
    way
FROM planet_osm_point
WHERE
	name IS NOT NULL AND
	power is null AND
	amenity is null
;

GRANT SELECT ON public.v_osm_points_pinds TO postgres;
```
