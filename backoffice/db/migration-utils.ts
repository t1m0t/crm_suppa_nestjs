// scripts/migration-utils.ts
import { sql } from "bun";
import { readdirSync, readFileSync } from "fs";
import path from "path";

export type ParsedMigration = {
	name: string;
	up: string;
	down: string | null;
};

// Parse a migration file into { up, down }
export function parseMigrationFile(
	filePath: string,
	name: string,
): ParsedMigration {
	const content = readFileSync(filePath, "utf8");

	const upMarker = /^--\s*migrate:up\s*$/im;
	const downMarker = /^--\s*migrate:down\s*$/im;

	const upMatch = content.match(upMarker);
	if (!upMatch) {
		throw new Error(`Missing "-- migrate:up" section in migration ${name}`);
	}

	const upIndex = upMatch.index! + upMatch[0].length;
	const downMatch = content.match(downMarker);

	let upSql: string;
	let downSql: string | null = null;

	if (downMatch) {
		const downIndex = downMatch.index!;
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

// List migration files sorted (001_..., 002_... or timestamp-based)
export function listMigrationFiles(dir = "./migrations"): string[] {
	return readdirSync(dir)
		.filter((f) => f.endsWith(".sql"))
		.sort(); // lexicographic sort works with 001_ / 20250101_...
}

export function getMigrationPath(
	fileName: string,
	dir = "./migrations",
): string {
	return path.join(dir, fileName);
}

export async function getLastMigration(): Promise<string | null> {
	const rows = await sql<{ name: string }[]>`
    SELECT name
    FROM migrations
    ORDER BY run_on DESC, id DESC
    LIMIT 1
  `;
	return rows.length ? rows[0].name : null;
}
