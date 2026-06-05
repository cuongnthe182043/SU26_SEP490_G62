const notificationRepository = require('../repositories/notificationRepository');
const notificationGateway = require('./notificationGateway');

const createForUser = async (userId, payload, options = {}) => {
    if (!userId) throw new Error('userId is required');
    if (!payload?.title) throw new Error('Notification title is required');

    const notification = await notificationRepository.createNotification({
        userId,
        title: payload.title,
        message: payload.message ?? payload.body ?? '',
        type: payload.type ?? 'SYSTEM_ALERT',
        entityType: payload.entityType ?? payload.entity_type ?? null,
        entityId: payload.entityId ?? payload.entity_id ?? payload.target_id ?? null,
    });

    notificationGateway.notifyCreated(notification, {
        displayMode: options.displayMode ?? payload.displayMode ?? 'toast',
    });

    return notification;
};

const createForUsers = async (userIds, payload, options = {}) => {
    const uniqueIds = [...new Set((userIds ?? []).filter(Boolean).map(Number))];
    return Promise.all(uniqueIds.map((userId) => createForUser(userId, payload, options)));
};

const listForUser = async (userId, { limit = 20, page = 1 } = {}) => {
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const [notifications, unreadCount, total] = await Promise.all([
        notificationRepository.listByUser(userId, {
            limit: safeLimit,
            offset: (safePage - 1) * safeLimit,
        }),
        notificationRepository.countUnread(userId),
        notificationRepository.countAll(userId),
    ]);

    return {
        notifications,
        unreadCount,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
    };
};

const markAsRead = (userId, notificationId) => {
    return notificationRepository.markAsRead(userId, notificationId);
};

const markAllAsRead = (userId) => {
    return notificationRepository.markAllAsRead(userId);
};

const getById = async (userId, notificationId) => {
    const notification = await notificationRepository.getById(userId, notificationId);
    if (!notification) return null;
    if (!notification.is_read) {
        await notificationRepository.markAsRead(userId, notificationId);
        notification.is_read = true;
    }
    return notification;
};

module.exports = {
    createForUser,
    createForUsers,
    listForUser,
    markAsRead,
    markAllAsRead,
    getById,
};
