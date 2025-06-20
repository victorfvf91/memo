const knex = require('knex');
const Redis = require('redis');

// PostgreSQL configuration
const dbConfig = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'password',
      database: 'bookmarking_app_dev'
    },
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    },
    pool: {
      min: 2,
      max: 10
    }
  },
  test: {
    client: 'postgresql',
    connection: process.env.TEST_DATABASE_URL || {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'password',
      database: 'bookmarking_app_test'
    },
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },
  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations'
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};

const environment = process.env.NODE_ENV || 'development';
const config = dbConfig[environment];

const db = knex(config);

// Redis configuration
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected');
});

// Connect to Redis
(async () => {
  await redisClient.connect();
})();

module.exports = {
  db,
  redisClient
}; 