import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@@/drizzle/schema';
import * as relations from '@@/drizzle/relations';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Logger } from '@nestjs/common';

export const DRIZZLE_DB = 'DRIZZLE_DB';
export const DRIZZLE_POOL = 'DRIZZLE_POOL';

const fullSchema = { ...schema, ...relations };

export type DrizzleDB = NodePgDatabase<typeof fullSchema>;

export const drizzleProvider = [
  {
    provide: DRIZZLE_POOL,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
      const connectionString = configService.get<string>('DATABASE_URL');
      if (!connectionString) {
        Logger.error('DATABASE_URL is not defined in environment variables');
        throw new Error('DATABASE_URL is not defined in environment variables');
      }

      const pool = new Pool({
        connectionString,
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
        allowExitOnIdle: false,
        // server-side cancel before client timeout
        statement_timeout: 25000,
        query_timeout: 30000,
        application_name: 'ligla-chat-bff',
      });

      pool.on('error', (err) => {
        Logger.error('Unexpected database pool error', err.stack, 'DrizzleProvider');
      });

      Logger.log('Drizzle database connection pool created', 'DrizzleProvider');

      return pool;
    },
  },
  {
    provide: DRIZZLE_DB,
    inject: [DRIZZLE_POOL],
    useFactory: async (pool: Pool) => {
      return drizzle(pool, { schema: fullSchema }) as DrizzleDB;
    },
  },
];
