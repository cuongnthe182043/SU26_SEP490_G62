const notificationService = require('./notificationService');

const notifyRoles = async (roles = [], payload, options = {}) => {
    const uniqueRoles = [...new Set((roles || []).filter(Boolean))];
    const excludeUserId = options.excludeUserId ? Number(options.excludeUserId) : null;

    const roleUserIds = await Promise.all(
        uniqueRoles.map((role) => notificationService.getUserIdsByRole(role)),
    );

    const userIds = [...new Set(roleUserIds.flat().map(Number))]
        .filter((userId) => Number.isInteger(userId) && userId > 0)
        .filter((userId) => !excludeUserId || userId !== excludeUserId);

    if (userIds.length === 0) return [];

    return notificationService.createForUsers(userIds, payload, {
        displayMode: options.displayMode || 'toast',
    });
};

const notifyRolesSafe = (roles, payload, options = {}) => {
    notifyRoles(roles, payload, options).catch((err) => {
        console.error('[roleNotificationService] Could not send role notifications:', err.message);
    });
};

module.exports = {
    notifyRoles,
    notifyRolesSafe,
};
