// backend/src/config/database.js
// Configuración de Sequelize para PostgreSQL

const { Sequelize } = require('sequelize');
const logger = require('./logger');

const dbSSL = process.env.DB_SSL === 'true';

const sequelize = new Sequelize(
  process.env.DB_NAME || 'omnichannel',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: (msg) => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(msg);
      }
    },
    ...(dbSSL && {
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false },
      },
    }),
    pool: {
      max:     parseInt(process.env.DB_POOL_MAX)     || 10,
      min:     parseInt(process.env.DB_POOL_MIN)     || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle:    parseInt(process.env.DB_POOL_IDLE)    || 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    },
  }
);

// Función para conectar y probar la conexión
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ PostgreSQL conectado correctamente');
  } catch (error) {
    logger.error('❌ Error conectando a PostgreSQL:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
