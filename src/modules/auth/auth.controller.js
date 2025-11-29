import { getUserByEmail, createUser } from "../users/user.model.js";
import { generateToken, generateRefreshToken } from "../../utils/jwt.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import { errorHandlerController } from "../../helpers/errorHandlerController.js";
import { cookieOptions, clearOptions } from "../../config/cookies.js";



const registerController = async (req, res) => {
    const {name, email, password} = req.body;
    if (!name || !email || !password) {
        return errorHandlerController("Todos los campos son obligatorios", 400, res);
    }
    try {
        const emailExists = await getUserByEmail(email);
        if (emailExists) {
            return errorHandlerController("El email ya existe", 400, res);
        }
        const password_hash = await hashPassword(password);  
        const id = await createUser({name, email, password: password_hash});
        res.status(201).json({message: "Usuario creado exitosamente", id}); 
    } catch (error) {
        return errorHandlerController("Error al registrar el usuario", 500, res, error);
    }
};
    

const loginController = async (req, res) => {
    const {email, password} = req.body;
    if (!email || !password) {
        return errorHandlerController("Todos los campos son obligatorios", 400, res);
    }
    try {
        const user = await getUserByEmail(email);
        if (!user) {
            return errorHandlerController("Credenciales inválidas", 401, res);
        }
        if (!user.is_visible) {
            return errorHandlerController("Usuario desactivado", 403, res);
        }
        const validPassword = await comparePassword(password, user.password);
        if (!validPassword) {
            return errorHandlerController("Credenciales inválidas", 401, res);
        }
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);
        res.cookie("token", token, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000 // 15 minutos
        });
        res.cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
        });
        res.json({message: "Inicio de sesión exitoso"});
    } catch (error) {
        return errorHandlerController("Error al iniciar sesión", 500, res, error);
    }
};  

const logoutController = async (req, res) => {
    res.clearCookie("token", clearOptions);
    res.clearCookie("refreshToken", clearOptions);
    res.json({message: "Cierre de sesión exitoso"});
};

const refreshController = async (req, res) => {
    try {
        const user = req.user;
        const newToken = generateToken({ id_user: user.id_user });
        
        res.cookie("token", newToken,   {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000 // 15 minutos
        });
        res.json({message: "Token renovado exitosamente"});
    } catch (error) {
        return errorHandlerController("Error al renovar el token", 500, res, error);
    }
};

export {registerController, loginController, logoutController, refreshController};