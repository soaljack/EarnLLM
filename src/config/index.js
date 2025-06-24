const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Define configuration schema
const envVarsSchema = Joi.object(
  {
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),
    DB_HOST: Joi.string().required().description('Database host'),
    DB_PORT: Joi.number().required().description('Database port'),
    DB_USER: Joi.string().required().description('Database user'),
    DB_PASSWORD: Joi.string().required().description('Database password'),
    DB_NAME: Joi.string().required().description('Database name'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number()
      .default(30)
      .description('minutes after which access tokens expire'),
    OPENAI_API_KEY: Joi.string().required().description('OpenAI API Key'),
    STRIPE_SECRET_KEY: Joi.string().required().description('Stripe Secret Key'),
    STRIPE_WEBHOOK_SECRET: Joi.string().required().description('Stripe Webhook Secret'),
    FRONTEND_URL: Joi.string().required().description('Frontend URL for CORS'),
  },
)
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  sequelize: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    username: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    database: envVars.DB_NAME,
    dialect: 'postgres',
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
  },
  openai: {
    apiKey: envVars.OPENAI_API_KEY,
  },
  stripe: {
    secretKey: envVars.STRIPE_SECRET_KEY,
    webhookSecret: envVars.STRIPE_WEBHOOK_SECRET,
  },
  cors: {
    origin: envVars.FRONTEND_URL,
  },
};
