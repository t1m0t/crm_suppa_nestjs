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
      SELECT FROM information_schema.schemata WHERE schema_name = 'backoffice_app'
    ) THEN
      EXECUTE 'CREATE SCHEMA backoffice_app';
  END IF;
END
$$;

```

## Create migration user

```sql
CREATE USER migration_user WITH PASSWORD 'migration_user_password';
GRANT CONNECT ON DATABASE suppavisor_backoffice TO migration_user;

GRANT USAGE, CREATE ON SCHEMA map_data TO migration_user;
GRANT USAGE, CREATE ON SCHEMA backoffice_data TO migration_user;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.migration
TO migration_user;

REVOKE ALL ON SCHEMA public FROM migration_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA map_data
GRANT ALL ON TABLES TO migration_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA backoffice_data
GRANT ALL ON TABLES TO migration_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA map_data
GRANT ALL ON SEQUENCES TO migration_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA backoffice_data
GRANT ALL ON SEQUENCES TO migration_user;
```

## Create app user

```sql
CREATE USER app_user WITH PASSWORD 'app_user_password';

GRANT CONNECT ON DATABASE suppavisor_backoffice TO app_user;

GRANT USAGE ON SCHEMA map_data TO app_user;
GRANT USAGE ON SCHEMA backoffice_data TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA map_data
TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA backoffice_data
TO app_user;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA map_data
TO app_user;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA backoffice_data
TO app_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA map_data
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA backoffice_data
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA map_data
GRANT USAGE, SELECT ON SEQUENCES TO app_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA backoffice_data
GRANT USAGE, SELECT ON SEQUENCES TO app_user;

```

ALternative setup

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
--   psql -U postgres -d YOUR_DB -f setup_roles.sql
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
      WITH LOGIN PASSWORD 'CHANGE_ME_admin_password'
      CREATEDB CREATEROLE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_user') THEN
    CREATE ROLE migration_user
      WITH LOGIN PASSWORD 'CHANGE_ME_migration_password';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user
      WITH LOGIN PASSWORD 'CHANGE_ME_app_password';
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
GRANT CONNECT ON DATABASE YOUR_DB
TO admin_user, migration_user, app_user;

-- Optional:
-- GRANT CREATE ON DATABASE YOUR_DB TO admin_user; -- extensions

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

-- Optional (metadata visibility only):
-- GRANT USAGE ON SCHEMA map_data, backoffice_data TO admin_user;

-- -----------------------
-- 8) Optional hardening suggestions
-- -----------------------
-- A) Lock down public schema if unused
-- REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- B) Ensure migrations run as migration_user
--    (migration_user inherits role_migrate)

-- C) Never connect apps using role_migrate or admin_user
-- ============================================================

```
