import { drizzle } from "drizzle-orm/node-postgres";
import pg, { type PoolConfig } from "pg";
import * as schema from "./schema";
import {
  createIpv4ResolvedSocket,
  shouldUseProtocolDnsResolver,
} from "./neonDns";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;
const poolConfig: PoolConfig = { connectionString };

if (shouldUseProtocolDnsResolver(connectionString)) {
  poolConfig.stream = () => createIpv4ResolvedSocket();
}

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });

export * from "./schema";
