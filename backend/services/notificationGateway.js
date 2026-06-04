const WebSocket = require('ws');
const authService = require('./authService');

const clientsByUserId = new Map();

const sendJson = (socket, payload) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
};

const addClient = (userId, socket) => {
    const key = String(userId);
    const clients = clientsByUserId.get(key) ?? new Set();
    clients.add(socket);
    clientsByUserId.set(key, clients);

    socket.on('close', () => {
        clients.delete(socket);
        if (clients.size === 0) clientsByUserId.delete(key);
    });
};

const broadcastToUser = (userId, payload) => {
    const clients = clientsByUserId.get(String(userId));
    if (!clients) return;
    for (const client of clients) sendJson(client, payload);
};

const notifyCreated = (notification, options = {}) => {
    broadcastToUser(notification.user_id, {
        type: 'notification.created',
        notification: {
            ...notification,
            display_mode: options.displayMode ?? notification.display_mode ?? 'toast',
        },
    });
};

const initNotificationGateway = (server) => {
    const wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/ws/notifications') return;

        const token = url.searchParams.get('token');
        if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        let decoded;
        try {
            decoded = authService.verifyToken(token);
        } catch {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            addClient(decoded.userId, ws);
            sendJson(ws, { type: 'notification.connected' });
        });
    });

    return wss;
};

module.exports = {
    initNotificationGateway,
    notifyCreated,
};
