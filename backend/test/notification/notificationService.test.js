const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert');
const notificationService = require('../../services/notificationService');
const notificationRepository = require('../../repositories/notificationRepository');
const notificationGateway = require('../../services/notificationGateway');
const fcmService = require('../../services/fcmService');
const pool = require('../../config/database');

describe('L1: Notification Service Unit Tests', () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    describe('Block: createForUser()', () => {
        it('L1-NOTI-01: BC-TRUE - Rejects if userId is missing', async () => {
            await assert.rejects(
                () => notificationService.createForUser(null, { title: 'T' }),
                { message: 'userId is required' }
            );
        });

        it('L1-NOTI-02: BC-TRUE - Rejects if title is missing', async () => {
            await assert.rejects(
                () => notificationService.createForUser(1, { message: 'msg' }),
                { message: 'Notification title is required' }
            );
        });

        it('L1-NOTI-03: EP-Valid - Creates notification, calls WS and FCM', async () => {
            mock.method(notificationRepository, 'createNotification', async () => ({ id: 5, user_id: 1, title: 'T' }));
            mock.method(notificationGateway, 'notifyCreated', () => {});
            mock.method(fcmService, 'sendNotification', async () => {});

            const res = await notificationService.createForUser(1, { title: 'T', message: 'M', type: 'INFO' });
            assert.strictEqual(res.id, 5);
            assert.strictEqual(notificationGateway.notifyCreated.mock.calls.length, 1);
            assert.strictEqual(fcmService.sendNotification.mock.calls.length, 1);
        });
    });

    describe('Block: listForUser()', () => {
        it('L1-NOTI-04: EP-Valid - Returns list with pagination metadata', async () => {
            mock.method(notificationRepository, 'listByUser', async () => [{ id: 1 }]);
            mock.method(notificationRepository, 'countUnread', async () => 1);
            mock.method(notificationRepository, 'countAll', async () => 1);

            const res = await notificationService.listForUser(1, { limit: 10, page: 1 });
            assert.strictEqual(res.total, 1);
            assert.strictEqual(res.unreadCount, 1);
            assert.strictEqual(res.notifications.length, 1);
        });
    });

    describe('Block: markAsRead() & markAllAsRead()', () => {
        it('L1-NOTI-05: EP-Valid - markAsRead triggers WS', async () => {
            mock.method(notificationRepository, 'markAsRead', async () => ({ id: 5 }));
            mock.method(notificationGateway, 'notifyRead', () => {});

            const res = await notificationService.markAsRead(1, 5);
            assert.strictEqual(res.id, 5);
            assert.strictEqual(notificationGateway.notifyRead.mock.calls.length, 1);
        });

        it('L1-NOTI-06: EP-Valid - markAllAsRead triggers WS', async () => {
            mock.method(notificationRepository, 'markAllAsRead', async () => {});
            mock.method(notificationGateway, 'notifyAllRead', () => {});

            await notificationService.markAllAsRead(1);
            assert.strictEqual(notificationGateway.notifyAllRead.mock.calls.length, 1);
        });
    });

    describe('Block: broadcastToRole() & getUserIdsByRole()', () => {
        it('L1-NOTI-07: EP-Valid - broadcastToRole uses WS only', async () => {
            mock.method(notificationGateway, 'broadcastToRole', () => {});
            
            notificationService.broadcastToRole('manager', { title: 'Alert' });
            assert.strictEqual(notificationGateway.broadcastToRole.mock.calls.length, 1);
        });

        it('L1-NOTI-08: EP-Valid - getUserIdsByRole uses DB pool directly', async () => {
            mock.method(pool, 'query', async () => ({ rows: [{ id: 2 }, { id: 3 }] }));
            const res = await notificationService.getUserIdsByRole('driver');
            assert.deepStrictEqual(res, [2, 3]);
        });
    });

    describe('Block: getById()', () => {
        it('L1-NOTI-09: EP-Valid - Returns notification and marks read if unread', async () => {
            mock.method(notificationRepository, 'getById', async () => ({ id: 5, is_read: false }));
            mock.method(notificationRepository, 'markAsRead', async () => ({ id: 5, is_read: true }));

            const res = await notificationService.getById(1, 5);
            assert.strictEqual(res.id, 5);
            assert.strictEqual(res.is_read, true); // It got mutated
            assert.strictEqual(notificationRepository.markAsRead.mock.calls.length, 1);
        });
    });
});
