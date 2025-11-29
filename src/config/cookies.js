import dotenv from "dotenv";
dotenv.config();

const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
};

const clearOptions = {
  ...cookieOptions,
  maxAge: 0,
};

export { cookieOptions, clearOptions };