import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import * as dotenv from "dotenv";
import { ConsoleLogger } from "@nestjs/common";

if (process.env.NODE_ENV)
	dotenv.config({ path: `${process.cwd()}/.env.${process.env.NODE_ENV}` });

async function bootstrap() {
	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter(),
		{
			logger: new ConsoleLogger({
				logLevels: ["error", "warn", "log", "debug"],
			}),
		},
	);
	await app.listen(process.env.PORT ?? 3030);
}

bootstrap();
