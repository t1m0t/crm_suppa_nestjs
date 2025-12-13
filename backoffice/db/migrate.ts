import { SQL } from "bun";
import {
	listMigrationFiles,
	getMigrationPath,
	parseMigrationFile,
	getLastMigration,
} from "./migration-utils";

type TEnvData = {
	dbParams: {
		maxPoolCon: number | undefined;
		idleTimeout: number | undefined;
		conMaxLifetime: number | undefined;
		conTimeout: number | undefined;
		dbHost: string | undefined;
		dbPort: string | undefined;
		dbName: string | undefined;
	};
	migrationUser: {
		name: string | undefined;
		password: string | undefined;
	};
};

class MigrationManager {
	private sqlClient: SQL.Query<SQL.Options>;

	constructor() {
		const envData = this.getEnvData();

		const dbUrl = `postgres://${envData.migrationUser.name}:${envData.migrationUser.password}@${envData.dbParams.dbHost}:${envData.dbParams.dbPort}/${envData.dbParams.dbName}`;

		console.debug("Database URL:", dbUrl);

		this.sqlClient = new SQL({
			adapter: "postgres",
			// Connection details (adapter is auto-detected as PostgreSQL)
			url: dbUrl,

			// Connection pool settings
			max: envData.dbParams.maxPoolCon, // Maximum connections in pool
			idleTimeout: envData.dbParams.idleTimeout, // Close idle connections after 30s
			maxLifetime: envData.dbParams.conMaxLifetime, // Connection lifetime in seconds (0 = forever)
			connectionTimeout: envData.dbParams.conTimeout, // Timeout when establishing new connections

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

	private getEnvData(): TEnvData {
		const envRequired: Array<string> = [
			"DB_MAX_POOL_CON",
			"DB_IDLE_TIMEOUT",
			"DB_MAX_CON_LIFETIME",
			"DB_CON_TIMEOUT",
			"DB_MIGRATION_USER",
			"DB_MIGRATION_PASSWORD",
			"DB_HOST",
			"DB_PORT",
			"DB_NAME",
		];

		const missingEnv: Array<string> = [];
		envRequired.forEach((key) => {
			if (!process.env[key]) missingEnv.push(key);
		});

		if (missingEnv.length > 0) {
			throw new Error(
				`Missing environment variables: ${missingEnv.join(", ")}`,
			);
		}

		const envData: TEnvData = {
			dbParams: {
				maxPoolCon: Number(process.env.DB_MAX_POOL_CON),
				idleTimeout: Number(process.env.DB_IDLE_TIMEOUT),
				conMaxLifetime: Number(process.env.DB_MAX_CON_LIFETIME),
				conTimeout: Number(process.env.DB_CON_TIMEOUT),
				dbHost: process.env.DB_HOST,
				dbPort: process.env.DB_PORT,
				dbName: process.env.DB_NAME,
			},
			migrationUser: {
				name: process.env.DB_MIGRATION_USER,
				password: process.env.DB_MIGRATION_PASSWORD,
			},
		};

		return envData;
	}

	private async ensureDatabaseSetup() {
		await this.ensureMigrationsTable();
	}

	private async ensureMigrationsTable() {
		await this.sqlClient`
    CREATE TABLE IF NOT EXISTS backoffice_data.migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      run_on TIMESTAMP DEFAULT NOW()
    );
  `;
	}

	private async getAppliedMigrations(): Promise<Set<string>> {
		const rows = await this.sqlClient<
			{ name: string }[]
		>`SELECT name FROM backoffice_data.migrations ORDER BY id`;
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
				console.log(`√ Already applied: ${file}`);
				continue;
			}

			const filePath = getMigrationPath(file);
			const parsed = parseMigrationFile(filePath, file);

			console.log(`➡ Applying ${file} ...`);

			try {
				await this.sqlClient.begin(async (tx) => {
					await tx`${parsed.up}`;
					await tx`
          INSERT INTO backoffice_data.migrations (name)
          VALUES (${file})
        `;
				});

				console.log(`√ Applied: ${file}`);
			} catch (err) {
				console.error(`❌ Failed on ${file}`);
				console.error(err);
				process.exit(1);
			}
		}

		await this.sqlClient.end();
	}

	public async rollback() {
		const last = await getLastMigration();

		if (!last) {
			console.log("No migrations to rollback.");
			await this.sqlClient.end();
			return;
		}

		const filePath = getMigrationPath(last);
		const parsed = parseMigrationFile(filePath, last);

		if (!parsed.down) {
			console.error(
				`❌ Migration ${last} has no "down" section. Cannot rollback safely.`,
			);
			await this.sqlClient.end();
			process.exit(1);
		}

		console.log(`↩ Rolling back ${last} ...`);

		try {
			await this.sqlClient.begin(async (tx) => {
				await tx`${parsed.down!}`;
				await tx`DELETE FROM backoffice_data.migrations WHERE name = ${last}`;
			});

			console.log(`√ Rolled back: ${last}`);
		} catch (err) {
			console.error(`❌ Failed to rollback ${last}`);
			console.error(err);
			process.exit(1);
		} finally {
			await this.sqlClient.end();
		}
	}
}

const migrationManager = new MigrationManager();
if (process.argv.length && process.argv[0] === "rollback")
	migrationManager.rollback();
else migrationManager.migrate();
