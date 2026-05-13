import dotenv from 'dotenv';

dotenv.config();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
];

export { allowedOrigins };
