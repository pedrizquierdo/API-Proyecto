import express from "express";
import pool from "./config/db.js";
import dotenv from "dotenv";


dotenv.config();

const app = express();
const PORT = process.env.PORT;
app.use(express.json());

app.get("/", async (req, res) => {
  try {
    const [row] = await pool.query("SELECT NOW() AS result");
    res.status(200).send(`¡Hola Mundo! La hora del servidor es: ${row[0].result}`);
  } catch (err) {
    console.error("Error en la DB:", err);
    res.status(500).send("Error en la base de datos");
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});