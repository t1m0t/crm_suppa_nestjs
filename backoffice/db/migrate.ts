import { readdirSync, readFileSync } from "fs";
import * as path from "path";
import { SQL } from "bun"; // Assuming your custom SQL wrapper is exported like this

type ParsedMigration = {
	name: string;
	up: string;
	down: string | null;
};

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
	private sqlClient: ReturnType<typeof SQL>;
	private migrationDir = "./db/migrations";

	constructor() {
		const envData = this.getEnvData();

		const dbUrl = `postgres://${envData.migrationUser.name}:${envData.migrationUser.password}@${envData.dbParams.dbHost}:${envData.dbParams.dbPort}/${envData.dbParams.dbName}`;

		this.sqlClient = new SQL(dbUrl, {
			max: envData.dbParams.maxPoolCon,
			idleTimeout: envData.dbParams.idleTimeout,
			maxLifetime: envData.dbParams.conMaxLifetime,
			connectionTimeout: envData.dbParams.conTimeout,
			tls: process.env.DATABASE_TLS_ENABLED === "true",
		});
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
		console.log(`√ Table Migrations ensured`);
	}

	private async getAppliedMigrations(): Promise<Set<string>> {
		const rows = await this.sqlClient<{ name: string }[]>`
      SELECT name FROM backoffice_data.migrations ORDER BY id
    `;
		return new Set(rows.map((r) => r.name));
	}

	public async migrate() {
		await this.ensureDatabaseSetup();
		const applied = await this.getAppliedMigrations();
		const files = this.listMigrationFiles();

		if (files.length === 0) {
			console.log("No migration files found in ./migrations");
			await this.sqlClient.end?.();
			return;
		}

		for (const file of files) {
			if (applied.has(file)) {
				console.log(`√ Already applied: ${file}`);
				continue;
			}

			const filePath = this.getMigrationPath(file);
			const parsed = this.parseMigrationFile(filePath, file);

			console.log(`➡ Applying ${file} ...`);

			try {
				await this.sqlClient.begin(async (tx) => {
					await tx.unsafe(parsed.up);
					await tx`
              INSERT INTO backoffice_data.migrations (name)
              VALUES (${file})
            `;
				});
				console.log(`√ Applied: ${file}`);
			} catch (err) {
				console.error(`❌ Failed on ${file}`);
				console.error(err);
				if (err.position)
					console.error(this.getSqlContext(parsed.up, err.position));
				await this.sqlClient.end?.();
				process.exit(1);
			}
		}
		await this.sqlClient.end?.();
	}

	public async rollback() {
		await this.ensureDatabaseSetup();
		const last = await this.getLastMigration();

		if (!last) {
			console.log("No migrations to rollback.");
			await this.sqlClient.end?.();
			return;
		}

		const filePath = this.getMigrationPath(last);
		const parsed = this.parseMigrationFile(filePath, last);

		if (!parsed.down) {
			console.error(
				`❌ Migration ${last} has no "down" section. Cannot rollback safely.`,
			);
			await this.sqlClient.end?.();
			process.exit(1);
		}

		console.log(`↩ Rolling back ${last} ...`);

		try {
			if (this.sqlClient.begin) {
				await this.sqlClient.begin(async (tx) => {
					await tx(parsed.down as string);
					await tx`
            DELETE FROM backoffice_data.migrations WHERE name = ${last}
          `;
				});
			} else {
				await this.sqlClient(parsed.down as string);
				await this.sqlClient`
          DELETE FROM backoffice_data.migrations WHERE name = ${last}
        `;
			}
			console.log(`√ Rolled back: ${last}`);
		} catch (err) {
			console.error(`❌ Failed to rollback ${last}`);
			console.error(err);
			if (err.position)
				console.error(this.getSqlContext(parsed.down, err.position));
			await this.sqlClient.end?.();
			process.exit(1);
		}
		await this.sqlClient.end?.();
	}

	private listMigrationFiles(): string[] {
		return readdirSync(this.migrationDir)
			.filter((f) => f.endsWith(".sql"))
			.sort();
	}

	private parseMigrationFile(filePath: string, name: string): ParsedMigration {
		const content = readFileSync(filePath, "utf8");

		const upMarker = /^--\s*migrate:up\s*$/im;
		const downMarker = /^--\s*migrate:down\s*$/im;

		const upMatch = content.match(upMarker);
		if (!upMatch || upMatch.index === undefined) {
			throw new Error(`Missing "-- migrate:up" section in migration ${name}`);
		}

		const upIndex = upMatch.index + upMatch[0].length;
		const downMatch = content.match(downMarker);

		let upSql: string;
		let downSql: string | null = null;

		if (downMatch && downMatch.index !== undefined) {
			const downIndex = downMatch.index;
			upSql = content.slice(upIndex, downIndex).trim();
			const downBodyIndex = downIndex + downMatch[0].length;
			downSql = content.slice(downBodyIndex).trim() || null;
		} else {
			upSql = content.slice(upIndex).trim();
		}

		if (!upSql) {
			throw new Error(`Empty "up" section in migration ${name}`);
		}

		return { name, up: upSql, down: downSql };
	}

	private getMigrationPath(fileName: string, dir = this.migrationDir): string {
		return path.join(dir, fileName);
	}

	private async getLastMigration(): Promise<string | null> {
		const rows = await this.sqlClient<{ name: string }[]>`
      SELECT name
      FROM backoffice_data.migrations
      ORDER BY run_on DESC, id DESC
      LIMIT 1
    `;
		return rows.length ? rows[0].name : null;
	}

	private getSqlContext(sql: string, position: number, radius = 40) {
		const index = Math.max(0, position - 1); // convert to 0-based
		const start = Math.max(0, index - radius);
		const end = Math.min(sql.length, index + radius);

		return {
			snippet: sql.slice(start, end),
			pointer: " ".repeat(index - start) + "^",
		};
	}
}

const migrationManager = new MigrationManager();
if (process.argv.length > 2 && process.argv[2] === "rollback")
	migrationManager.rollback();
else migrationManager.migrate();
