// knexfile.ts
import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const BASE_CONFIG: Partial<Knex.Config> = {
  client: 'pg',
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations', // buena práctica
  },
  seeds: {
    directory: './seeds',
  },
};

const config: { [key: string]: Knex.Config } = {
  development: {
    ...BASE_CONFIG,
    connection: {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'dev_user',
      password: process.env.DB_PASS || 'local_dev_password_only',
      database: process.env.DB_NAME || 'jwt_api_dev',
      port: parseInt(process.env.DB_PORT || '5432', 10),
    },
  },

  test: {
    ...BASE_CONFIG,
    connection: {
      host: process.env.TEST_DB_HOST || 'localhost',
      user: process.env.TEST_DB_USER || 'test_user',
      password: process.env.TEST_DB_PASS || 'local_dev_password_only',
      database: process.env.TEST_DB_NAME || 'jwt_api_test',
      port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
    },
  },

  production: {
    ...BASE_CONFIG,
    connection: {
      host: process.env.PROD_DB_HOST,
      user: process.env.PROD_DB_USER,
      password: process.env.PROD_DB_PASS,
      database: process.env.PROD_DB_NAME,
      port: parseInt(process.env.PROD_DB_PORT || '5432', 10),
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    },
  },
};

export default config;