export const errorHandlerController = (message, status, res, error = null) => {
    if (error) {
        console.error(error);
    }
    res.status(status).json({error: message});
};