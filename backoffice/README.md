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
