 WITH 
        bounds AS (
          SELECT ST_MakeEnvelope(8453323.830937501, 3639625.5383203123, 8492459.589414064, 3678761.296796875, 3857) AS geom
        ),
        
        -- Roads layer
        roads AS (
          SELECT 
            ST_AsMVTGeom(
              ST_Simplify(way, 10),
              bounds.geom,
              4096,
              256,
              true
            ) AS geom,
            name,
            highway,
            ref,
            oneway,
            bridge,
            tunnel,
            CASE 
              WHEN highway IN ('motorway', 'trunk') THEN 1
              WHEN highway IN ('primary', 'secondary') THEN 2
              WHEN highway IN ('tertiary', 'residential') THEN 3
              ELSE 4
            END AS priority
          FROM planet_osm_line, bounds
          WHERE way && bounds.geom
            AND highway IS NOT NULL
            AND (
              (10 >= 14) OR
              (10 >= 12 AND highway IN ('motorway', 'trunk', 'primary', 'secondary')) OR
              (10 >= 10 AND highway IN ('motorway', 'trunk', 'primary')) OR
              (10 < 10 AND highway IN ('motorway', 'trunk'))
            )
        ),
        
        -- Buildings layer (only at high zoom)
        buildings AS (
          SELECT 
            ST_AsMVTGeom(
              way,
              bounds.geom,
              4096,
              256,
              true
            ) AS geom,
            name,
            building,
            "building:levels" as levels
          FROM planet_osm_polygon, bounds
          WHERE 10 >= 14
            AND way && bounds.geom
            AND building IS NOT NULL
        ),
        
        -- POIs layer
        pois AS (
          SELECT 
            ST_AsMVTGeom(
              way,
              bounds.geom,
              4096,
              256,
              true
            ) AS geom,
            name,
            amenity,
            shop,
            tourism,
            leisure
          FROM planet_osm_point, bounds
          WHERE 10 >= 12
            AND way && bounds.geom
            AND (amenity IS NOT NULL OR shop IS NOT NULL OR tourism IS NOT NULL)
        ),
        
        -- Water/natural layer
        water AS (
          SELECT 
            ST_AsMVTGeom(
              ST_Simplify(way, 10),
              bounds.geom,
              4096,
              256,
              true
            ) AS geom,
            name,
            waterway,
            natural
          FROM planet_osm_polygon, bounds
          WHERE way && bounds.geom
            AND (waterway IS NOT NULL OR natural IN ('water', 'wetland'))
        ),
        
        -- Landuse layer
        landuse AS (
          SELECT 
            ST_AsMVTGeom(
              ST_Simplify(way, 20),
              bounds.geom,
              4096,
              256,
              true
            ) AS geom,
            landuse,
            leisure,
            natural
          FROM planet_osm_polygon, bounds
          WHERE 10 >= 10
            AND way && bounds.geom
            AND (landuse IS NOT NULL OR leisure IS NOT NULL OR natural IS NOT NULL)
            AND natural NOT IN ('water', 'wetland')
        )
        
        -- Combine all layers into MVT
        SELECT 
          (SELECT ST_AsMVT(roads.*, 'roads', 4096, 'geom') FROM roads WHERE geom IS NOT NULL) ||
          (SELECT ST_AsMVT(buildings.*, 'buildings', 4096, 'geom') FROM buildings WHERE geom IS NOT NULL) ||
          (SELECT ST_AsMVT(pois.*, 'pois', 4096, 'geom') FROM pois WHERE geom IS NOT NULL) ||
          (SELECT ST_AsMVT(water.*, 'water', 4096, 'geom') FROM water WHERE geom IS NOT NULL) ||
          (SELECT ST_AsMVT(landuse.*, 'landuse', 4096, 'geom') FROM landuse WHERE geom IS NOT NULL)
        AS tile;


