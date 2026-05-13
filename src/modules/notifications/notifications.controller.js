import { getNotifications, getUnreadCount, markAllRead, markOneRead } from './notifications.model.js';
import { errorHandlerController } from '../../helpers/errorHandlerController.js';
import { emitToUser } from '../../realtime/io.js';

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
        const { id_user } = req.user;
        await markAllRead(id_user);
        emitToUser(id_user, 'notification:read', { all: true });
        res.json({ message: 'Todas las notificaciones marcadas como leidas' });
    } catch (error) {
        errorHandlerController('Error marcando notificaciones', 500, res, error);
    }
};

const readOne = async (req, res) => {
    try {
        const { id_user } = req.user;
        await markOneRead(req.params.id, id_user);
        emitToUser(id_user, 'notification:read', { id: req.params.id });
        res.json({ message: 'Notificacion leida' });
    } catch (error) {
        errorHandlerController('Error marcando notificacion', 500, res, error);
    }
};

export { getMyNotifications, readAll, readOne };
