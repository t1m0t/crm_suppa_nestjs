import { sql, SQL } from "bun";
import {
	listMigrationFiles,
	getMigrationPath,
	parseMigrationFile,
	getLastMigration,
} from "./migration-utils";

class MigrationManager {
	private sqlMapDataAdmin: SQL.Query<SQL.Options>;
	private sqlBackofficeAdmin: SQL.Query<SQL.Options>;

	constructor() {
		this.sqlMapDataAdmin = new SQL({
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
		});

		this.sqlBackofficeAdmin = new SQL({
			// Connection details (adapter is auto-detected as PostgreSQL)
			url: `postgres://${process.env.DB_BACKOFFICE_APP_ADMIN_NAME}:${process.env.DB_BACKOFFICE_APP_ADMIN_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,

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
		});

		this.ensureDatabaseSetup();
	}

	private async ensureDatabaseSetup() {
		await this.ensureMigrationsTable();
	}

	private async ensureMigrationsTable() {
		await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      run_on TIMESTAMP DEFAULT NOW()
    );
  `;
	}

	private async getAppliedMigrations(): Promise<Set<string>> {
		const rows = await sql<
			{ name: string }[]
		>`SELECT name FROM migrations ORDER BY id`;
		return new Set(rows.map((r) => r.name));
	}

	public async migrate() {
		const applied = await this.getAppliedMigrations();
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
					await tx`${parsed.up}`;
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

	public async rollback() {
		const last = await getLastMigration();

		if (!last) {
			console.log("No migrations to rollback.");
			await sql.end();
			return;
		}

		const filePath = getMigrationPath(last);
		const parsed = parseMigrationFile(filePath, last);

		if (!parsed.down) {
			console.error(
				`❌ Migration ${last} has no "down" section. Cannot rollback safely.`,
			);
			await sql.end();
			process.exit(1);
		}

		console.log(`↩ Rolling back ${last} ...`);

		try {
			await sql.begin(async (tx) => {
				await tx`${parsed.down!}`;
				await tx`DELETE FROM migrations WHERE name = ${last}`;
			});

			console.log(`✔ Rolled back: ${last}`);
		} catch (err) {
			console.error(`❌ Failed to rollback ${last}`);
			console.error(err);
			process.exit(1);
		} finally {
			await sql.end();
		}
	}
}

const migrationManager = new MigrationManager();
if (process.argv.length && process.argv[0] === "rollback")
	migrationManager.rollback();
else migrationManager.migrate();
