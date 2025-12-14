# DB Setup

## Create SCHEMA

```sql
-- create schema
DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT FROM information_schema.schemata WHERE schema_name = 'map_data'
    ) THEN
      EXECUTE 'CREATE SCHEMA map_data';
  END IF;
END
$$;
```

```sql
-- create schema
DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT FROM information_schema.schemata WHERE schema_name = 'backoffice_data'
    ) THEN
      EXECUTE 'CREATE SCHEMA backoffice_data';
  END IF;
END
$$;

```

## Create roles and permissions

```sql
-- ============================================================
-- Strict role separation with GROUP ROLES (PostgreSQL)
-- ============================================================
-- Roles:
--   admin_user        -> DB & role administration only
--   migration_user    -> runs migrations (member of role_migrate)
--   app_user          -> application runtime (member of role_app_rw)
--
-- Group roles (NOLOGIN):
--   role_migrate      -> owns & migrates app schemas
--   role_app_rw       -> runtime CRUD access
--
-- Suggestion:
-- Run as postgres / DB owner:
--   psql -U postgres -d suppavisor_backoffice -f setup_roles.sql
-- ============================================================

-- -----------------------
-- 0) Create group roles
-- -----------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_migrate') THEN
    CREATE ROLE role_migrate NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_app_rw') THEN
    CREATE ROLE role_app_rw NOLOGIN;
  END IF;
END $$;

-- -----------------------
-- 1) Create login roles
-- -----------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_user') THEN
    CREATE ROLE admin_user
      WITH LOGIN PASSWORD 'admin_password'
      CREATEDB CREATEROLE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_user') THEN
    CREATE ROLE migration_user
      WITH LOGIN PASSWORD 'migration_password';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user
      WITH LOGIN PASSWORD 'app_password';
  END IF;
END $$;

-- -----------------------
-- 2) Role memberships
-- -----------------------
GRANT role_migrate TO migration_user;
GRANT role_app_rw TO app_user;

-- -----------------------
-- 3) Database-level access
-- -----------------------
GRANT CONNECT ON DATABASE suppavisor_backoffice
TO admin_user, migration_user, app_user;

-- Optional:
-- GRANT CREATE ON DATABASE suppavisor_backoffice TO admin_user; -- extensions

-- -----------------------
-- 4) Create schemas owned by role_migrate
-- -----------------------
-- Key design: schema owner is the GROUP ROLE, not the login role
CREATE SCHEMA IF NOT EXISTS map_data AUTHORIZATION role_migrate;
CREATE SCHEMA IF NOT EXISTS backoffice_data AUTHORIZATION role_migrate;

-- Allow migrations
GRANT USAGE, CREATE ON SCHEMA map_data, backoffice_data TO role_migrate;

-- -----------------------
-- 5) Runtime permissions for app_user (via role_app_rw)
-- -----------------------
GRANT USAGE ON SCHEMA map_data, backoffice_data TO role_app_rw;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA map_data, backoffice_data
TO role_app_rw;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA map_data, backoffice_data
TO role_app_rw;

-- -----------------------
-- 6) Default privileges (future-proof)
-- -----------------------
-- IMPORTANT:
-- Default privileges apply to objects created by role_migrate
-- Run these as postgres or SET ROLE role_migrate

ALTER DEFAULT PRIVILEGES FOR ROLE role_migrate IN SCHEMA map_data
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_app_rw;

ALTER DEFAULT PRIVILEGES FOR ROLE role_migrate IN SCHEMA backoffice_data
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_app_rw;

ALTER DEFAULT PRIVILEGES FOR ROLE role_migrate IN SCHEMA map_data
GRANT USAGE, SELECT ON SEQUENCES TO role_app_rw;

ALTER DEFAULT PRIVILEGES FOR ROLE role_migrate IN SCHEMA backoffice_data
GRANT USAGE, SELECT ON SEQUENCES TO role_app_rw;

-- -----------------------
-- 7) Keep admin_user out of app schemas (strict boundary)
-- -----------------------
REVOKE ALL ON SCHEMA map_data, backoffice_data FROM admin_user;

-- necessary for migration 001 to have point as a FK
ALTER TABLE map_data.planet_osm_point
ADD COLUMN id BIGSERIAL PRIMARY KEY;

GRANT REFERENCES ON ALL TABLES IN SCHEMA map_data TO role_migrate;
ALTER DEFAULT PRIVILEGES FOR ROLE role_migrate IN SCHEMA map_data
GRANT REFERENCES ON TABLES TO role_migrate;

-- 9. Create pg_tileserv user, read only on map_data schema
CREATE ROLE pgtileserv_user LOGIN PASSWORD 'pgtileserv_password';
GRANT USAGE ON SCHEMA map_data TO pgtileserv_user;
GRANT SELECT ON ALL TABLES IN SCHEMA map_data TO pgtileserv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA map_data
GRANT SELECT ON TABLES TO pgtileserv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA map_data
GRANT USAGE ON SEQUENCES TO pgtileserv_user;
REVOKE ALL ON SCHEMA map_data.FROM pgtileserv_user;
```
