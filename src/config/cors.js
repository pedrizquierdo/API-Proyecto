import dotenv from "dotenv";

dotenv.config();

const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173"
];

const corsOptions = {
    origin: (origin, callback) => {

        // Permite requests sin origin (Postman, backend interno)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`Not allowed by CORS: ${origin}`));
    },

    credentials: true, // Habilitar cookies cross-origin
};

export { corsOptions };