import jwt from "jsonwebtoken";

const generateToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("Falta JWT_SECRET");
    }

    const payload = {
        id_user: user.id_user,
        role: user.role 
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });
    return token;
};

const generateRefreshToken = (user) => {
    if (!process.env.JWT_SECRET_REFRESH) {
        throw new Error("Falta JWT_SECRET_REFRESH");
    }

    const payload = {
        id_user: user.id_user,
        role: user.role 
    };

    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET_REFRESH, { expiresIn: "30d" });
    return refreshToken;
};

export { generateToken, generateRefreshToken };