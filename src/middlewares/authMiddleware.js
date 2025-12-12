import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();    

const verifyToken = (req, res, next) => {
    const {token} = req.cookies;

    if (!token) {
        return res.status(401).json({error: "No se proporcionó un token"});
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({error: "Token inválido"});
        }
        req.user = user;
        next();
    });
};  

const verifyRefreshToken = (req, res, next) => {
    const {refreshToken} = req.cookies;
    if (!refreshToken) {
        return res.status(401).json({error: "No se proporcionó un token de refresco"});
    }
    jwt.verify(refreshToken, process.env.JWT_SECRET_REFRESH, (err, user) => {
        if (err) {
            return res.status(403).json({error: "Token de refresco inválido"});
        }
        req.user = user;
        next();
    });
};

const verifyAdmin = (req, res, next) => {
    console.log("VERIFICANDO ADMIN:");
    console.log("Usuario ID:", req.user?.id_user);
    console.log("Rol detectado:", req.user?.role);

    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        console.log("⛔ Bloqueado: No es admin.");
        return res.status(403).json({ message: "Acceso denegado: Requiere permisos de Administrador" });
    }
};

export {verifyToken, verifyRefreshToken, verifyAdmin};