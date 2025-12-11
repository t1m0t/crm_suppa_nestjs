# DB Setup

- for MAP DATA

```sql
-- create admin user
DO $$
  BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles WHERE rolname = 'map_data_admin';
    ) THEN
        CREATE ROLE map_data_admin LOGIN PASSWORD 'map_data_admin_password';
    END IF;
  END
$$;

-- create app user
DO $$
  BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles WHERE rolname = 'map_data_user';
    ) THEN
        CREATE ROLE map_data_user LOGIN PASSWORD 'map_data_user_password';
    END IF;
  END
$$;

-- create schema
DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT FROM information_schema.schemata WHERE schema_name = 'map_data'
    ) THEN
      EXECUTE 'CREATE SCHEMA map_data AUTHORIZATION map_data_admin';
  END IF;
END
$$;

REVOKE ALL ON SCHEMA map_data FROM PUBLIC;

-- permissions admin
GRANT USAGE, CREATE ON SCHEMA map_data TO map_data_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA map_data TO map_data_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA map_data TO map_data_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA map_data TO map_data_admin;

ALTER DEFAULT PRIVILEGES FOR USER map_data_admin IN SCHEMA map_data
GRANT ALL PRIVILEGES ON TABLES TO map_data_admin;

ALTER DEFAULT PRIVILEGES FOR USER map_data_admin IN SCHEMA map_data
GRANT ALL PRIVILEGES ON SEQUENCES TO map_data_admin;

ALTER DEFAULT PRIVILEGES FOR USER map_data_admin IN SCHEMA map_data
GRANT ALL PRIVILEGES ON FUNCTIONS TO map_data_admin;

-- permissions app user
GRANT USAGE ON SCHEMA map_data TO map_data_user;

GRANT SELECT, UPDATE ON ALL TABLES IN SCHEMA map_data TO map_data_user;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA map_data TO map_data_user;

ALTER DEFAULT PRIVILEGES FOR USER map_data_admin IN SCHEMA map_data
GRANT SELECT, UPDATE ON TABLES TO map_data_user;

ALTER DEFAULT PRIVILEGES FOR USER map_data_admin IN SCHEMA map_data
GRANT SELECT ON SEQUENCES TO map_data_user;

```

- for BACKOFFICE_APP

```sql
-- create admin user
DO $$
  BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles WHERE rolname = 'backoffice_app_admin';
    ) THEN
        CREATE ROLE backoffice_app_admin LOGIN PASSWORD 'backoffice_app_admin_password';
    END IF;
  END
$$;

-- create app user
DO $$
  BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles WHERE rolname = 'backoffice_app_user';
    ) THEN
        CREATE ROLE backoffice_app_user LOGIN PASSWORD 'backoffice_app_user_password';
    END IF;
  END
$$;

-- create schema
DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT FROM information_schema.schemata WHERE schema_name = 'backoffice_app'
    ) THEN
      EXECUTE 'CREATE SCHEMA backoffice_app AUTHORIZATION backoffice_app_admin';
  END IF;
END
$$;

REVOKE ALL ON SCHEMA backoffice_app FROM PUBLIC;

-- permissions admin
GRANT USAGE, CREATE ON SCHEMA backoffice_app TO backoffice_app_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA backoffice_app TO backoffice_app_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA backoffice_app TO backoffice_app_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA backoffice_app TO backoffice_app_admin;

ALTER DEFAULT PRIVILEGES FOR USER backoffice_app_admin IN SCHEMA backoffice_app
GRANT ALL PRIVILEGES ON TABLES TO backoffice_app_admin;

ALTER DEFAULT PRIVILEGES FOR USER backoffice_app_admin IN SCHEMA backoffice_app
GRANT ALL PRIVILEGES ON SEQUENCES TO backoffice_app_admin;

ALTER DEFAULT PRIVILEGES FOR USER backoffice_app_admin IN SCHEMA backoffice_app
GRANT ALL PRIVILEGES ON FUNCTIONS TO backoffice_app_admin;

-- permissions app user
GRANT USAGE ON SCHEMA backoffice_app TO backoffice_app_user;

GRANT SELECT, UPDATE ON ALL TABLES IN SCHEMA backoffice_app TO backoffice_app_user;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA backoffice_app TO backoffice_app_user;

ALTER DEFAULT PRIVILEGES FOR USER backoffice_app_admin IN SCHEMA backoffice_app
GRANT SELECT, UPDATE ON TABLES TO backoffice_app_user;

ALTER DEFAULT PRIVILEGES FOR USER backoffice_app_admin IN SCHEMA backoffice_app
GRANT SELECT ON SEQUENCES TO backoffice_app_user;
```

```

```
