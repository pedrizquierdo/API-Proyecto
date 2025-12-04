import jwt from "jsonwebtoken";

const generateToken = (user) => {
    const token = jwt.sign({id_user: user.id_user}, process.env.JWT_SECRET, {expiresIn: "15m"});
    return token;
};

const generateRefreshToken = (user) => {
    const refreshToken = jwt.sign({id_user: user.id_user}, process.env.JWT_SECRET_REFRESH, {expiresIn: "30d"});
    return refreshToken;
};

export { generateToken, generateRefreshToken };