import { getNotifications, getUnreadCount, markAllRead, markOneRead } from './notifications.model.js';
import { errorHandlerController } from '../../helpers/errorHandlerController.js';

const getMyNotifications = async (req, res) => {
    try {
        const { id_user } = req.user;
        const [notifications, unreadCount] = await Promise.all([
            getNotifications(id_user),
            getUnreadCount(id_user),
        ]);
        res.json({ notifications, unread_count: unreadCount });
    } catch (error) {
        errorHandlerController('Error obteniendo notificaciones', 500, res, error);
    }
};

const readAll = async (req, res) => {
    try {
        await markAllRead(req.user.id_user);
        res.json({ message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
        errorHandlerController('Error marcando notificaciones', 500, res, error);
    }
};

const readOne = async (req, res) => {
    try {
        await markOneRead(req.params.id, req.user.id_user);
        res.json({ message: 'Notificación leída' });
    } catch (error) {
        errorHandlerController('Error marcando notificación', 500, res, error);
    }
};

export { getMyNotifications, readAll, readOne };
