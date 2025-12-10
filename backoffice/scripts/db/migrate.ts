import { sql, SQL } from "bun"
// scripts/migrate.ts
import {
  listMigrationFiles,
  getMigrationPath,
  parseMigrationFile,
} from "./migration-utils";


class DbMigration {
  private const sqlMapDataAdmin: SQL.Query<SQL.PostgresOrMySQLOptions> | null = null
  private const sqlBackofficeAdmin: SQL.Query<SQL.PostgresOrMySQLOptions> | null = null

  constructor() {
    this.sqlMapDataAdmin = new SQL({
      adapter: 'postgres',
      // Connection details (adapter is auto-detected as PostgreSQL)
      url: `postgres://${process.env.DB_MAP_DATA_ADMIN_NAME}:${process.env.DB_MAP_DATA_ADMIN_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,

      // Connection pool settings
      max: process.env.DB_MAX_POOL_CON, // Maximum connections in pool
      idleTimeout: process.env.DB_IDLE_TIMEOUT, // Close idle connections after 30s
      maxLifetime: process.env.DB_MAX_CON_LIFETIME, // Connection lifetime in seconds (0 = forever)
      connectionTimeout: process.env.DB_CON_TIMEOUT, // Timeout when establishing new connections

      // SSL/TLS options
      tls: process.env.DATABASE_TLS_ENABLED,
      // tls: {
      //   rejectUnauthorized: true,
      //   requestCert: true,
      //   ca: "path/to/ca.pem",
      //   key: "path/to/key.pem",
      //   cert: "path/to/cert.pem",
      //   checkServerIdentity(hostname, cert) {
      //     ...
      //   },
      // },

      // Callbacks
      onconnect: client => {
        console.log("Connected to PostgreSQL with client: ", client);
      },
      onclose: client => {
        console.log("PostgreSQL connection closed with client: ", client);
      },
    });

    this.ensureDatabaseSetup()
  }

  private function ensureDatabaseSetup() {
    this.setupDbBackofficeApp()
    this.setupDbMapData()
  }

  private function setupDbBackofficeApp() {
    this.sqlBackofficeAdmin = await sql`
  ------------------------------------------------------------
  -- 1. CREATE ADMIN USER IF NOT EXISTS
  ------------------------------------------------------------
  DO $$
  BEGIN
      IF NOT EXISTS (
          SELECT FROM pg_catalog.pg_roles WHERE rolename = '${process.env.DB_BACKOFFICE_APP_ADMIN_NAME}'
      ) THEN
          CREATE ROLE ${process.env.DB_BACKOFFICE_APP_ADMIN_NAME} LOGIN PASSWORD '${process.env.DB_BACKOFFICE_APP_ADMIN_PASSWORD}';
      END IF;
  END
  $$;

  ------------------------------------------------------------
  -- 2. CREATE APP USER IF NOT EXISTS
  ------------------------------------------------------------
  DO $$
  BEGIN
      IF NOT EXISTS (
          SELECT FROM pg_catalog.pg_roles WHERE rolname = '${process.env.DB_BACKOFFICE_APP_USER_NAME}'
      ) THEN
          CREATE ROLE ${process.env.DB_BACKOFFICE_APP_USER_NAME} LOGIN PASSWORD '${process.env.DB_BACKOFFICE_APP_USER_PASSWORD}';
      END IF;
  END
  $$;

  ------------------------------------------------------------
  -- 3. CREATE SCHEMA IF NOT EXISTS (owned by admin)
  ------------------------------------------------------------
  DO $$
  BEGIN
      IF NOT EXISTS (
          SELECT FROM information_schema.schemata WHERE schema_name = '${process.env.DB_BACKOFFICE_APP_SCHEMA_NAME}'
      ) THEN
          EXECUTE 'CREATE SCHEMA ${process.env.DB_BACKOFFICE_APP_SCHEMA_NAME} AUTHORIZATION ${process.env.DB_BACKOFFICE_APP_ADMIN_NAME}';
      END IF;
  END
  $$;

  REVOKE ALL ON SCHEMA my_app FROM PUBLIC;

  ------------------------------------------------------------
  -- 4. ADMIN PRIVILEGES
  ------------------------------------------------------------
  GRANT USAGE, CREATE ON SCHEMA my_app TO my_app_admin;
  GRANT ALL PRIVILEGES ON ALL TABLES     IN SCHEMA my_app TO my_app_admin;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA my_app TO my_app_admin;
  GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA my_app TO my_app_admin;

  ALTER DEFAULT PRIVILEGES FOR USER my_app_admin IN SCHEMA my_app
  GRANT ALL PRIVILEGES ON TABLES TO my_app_admin;

  ALTER DEFAULT PRIVILEGES FOR USER my_app_admin IN SCHEMA my_app
  GRANT ALL PRIVILEGES ON SEQUENCES TO my_app_admin;

  ALTER DEFAULT PRIVILEGES FOR USER my_app_admin IN SCHEMA my_app
  GRANT ALL PRIVILEGES ON FUNCTIONS TO my_app_admin;

  ------------------------------------------------------------
  -- 5. APP USER PRIVILEGES (SELECT + UPDATE ONLY)
  ------------------------------------------------------------
  GRANT USAGE ON SCHEMA my_app TO my_app_user;

  GRANT SELECT, UPDATE ON ALL TABLES     IN SCHEMA my_app TO my_app_user;
  GRANT SELECT        ON ALL SEQUENCES IN SCHEMA my_app TO my_app_user;

  ALTER DEFAULT PRIVILEGES FOR USER my_app_admin IN SCHEMA my_app
  GRANT SELECT, UPDATE ON TABLES TO my_app_user;

  ALTER DEFAULT PRIVILEGES FOR USER my_app_admin IN SCHEMA my_app
  GRANT SELECT ON SEQUENCES TO my_app_user;
  `

  }
}

async function ensureDatabaseSetup() {
  await sql`
  ------------------------------------------------------------
  -- 1. CREATE ADMIN USER IF NOT EXISTS
  ------------------------------------------------------------
  DO $$
  BEGIN
      IF NOT EXISTS (
          SELECT FROM pg_catalog.pg_roles WHERE rolename = '${process.env.DB_BACKOFFICE_APP_ADMIN_NAME}'
      ) THEN
          CREATE ROLE ${process.env.DB_BACKOFFICE_APP_ADMIN_NAME} LOGIN PASSWORD '${process.env.DB_BACKOFFICE_APP_ADMIN_PASSWORD}';
      END IF;
  END
  $$;

  ------------------------------------------------------------
  -- 2. CREATE APP USER IF NOT EXISTS
  ------------------------------------------------------------
  DO $$
  BEGIN
      IF NOT EXISTS (
          SELECT FROM pg_catalog.pg_roles WHERE rolname = 'my_app_user'
      ) THEN
          CREATE ROLE my_app_user LOGIN PASSWORD 'STRONG_APP_PASSWORD';
      END IF;
  END
  $$;

  ------------------------------------------------------------
  -- 3. CREATE SCHEMA IF NOT EXISTS (owned by admin)
  ------------------------------------------------------------
  DO $$
  BEGIN
      IF NOT EXISTS (
          SELECT FROM information_schema.schemata WHERE schema_name = 'my_app'
      ) THEN
          EXECUTE 'CREATE SCHEMA my_app AUTHORIZATION my_app_admin';
      END IF;
  END
  $$;

  REVOKE ALL ON SCHEMA my_app FROM PUBLIC;

  ------------------------------------------------------------
  -- 4. ADMIN PRIVILEGES
  ------------------------------------------------------------
  GRANT USAGE, CREATE ON SCHEMA my_app TO my_app_admin;
  GRANT ALL PRIVILEGES ON ALL TABLES     IN SCHEMA my_app TO my_app_admin;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA my_app TO my_app_admin;
  GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA my_app TO my_app_admin;

  ALTER DEFAULT PRIVILEGES FOR USER my_app_admin IN SCHEMA my_app
  GRANT ALL PRIVILEGES ON TABLES TO my_app_admin;

  ALTER DEFAULT PRIVILEGES FOR USER my_app_admin IN SCHEMA my_app
  GRANT ALL PRIVILEGES ON SEQUENCES TO my_app_admin;

  ALTER DEFAULT PRIVILEGES FOR USER my_app_admin IN SCHEMA my_app
  GRANT ALL PRIVILEGES ON FUNCTIONS TO my_app_admin;

  ------------------------------------------------------------
  -- 5. APP USER PRIVILEGES (SELECT + UPDATE ONLY)
  ------------------------------------------------------------
  GRANT USAGE ON SCHEMA my_app TO my_app_user;

  GRANT SELECT, UPDATE ON ALL TABLES     IN SCHEMA my_app TO my_app_user;
  GRANT SELECT        ON ALL SEQUENCES IN SCHEMA my_app TO my_app_user;

  ALTER DEFAULT PRIVILEGES FOR USER my_app_admin IN SCHEMA my_app
  GRANT SELECT, UPDATE ON TABLES TO my_app_user;

  ALTER DEFAULT PRIVILEGES FOR USER my_app_admin IN SCHEMA my_app
  GRANT SELECT ON SEQUENCES TO my_app_user;
  `
}

async function ensureMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      run_on TIMESTAMP DEFAULT NOW()
    );
  `;
}

async function getAppliedMigrations(): Promise<Set<string>> {
  await ensureMigrationsTable();
  const rows = await sql<{ name: string }[]>`SELECT name FROM migrations ORDER BY id`;
  return new Set(rows.map((r) => r.name));
}

async function run() {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const files = listMigrationFiles();

  if (files.length === 0) {
    console.log("No migration files found in ./migrations");
    return;
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✔ Already applied: ${file}`);
      continue;
    }

    const filePath = getMigrationPath(file);
    const parsed = parseMigrationFile(filePath, file);

    console.log(`➡ Applying ${file} ...`);

    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(parsed.up); // can contain multiple statements
        await tx`
          INSERT INTO migrations (name)
          VALUES (${file})
        `;
      });

      console.log(`✔ Applied: ${file}`);
    } catch (err) {
      console.error(`❌ Failed on ${file}`);
      console.error(err);
      process.exit(1);
    }
  }

  await sql.end();
}

run();

