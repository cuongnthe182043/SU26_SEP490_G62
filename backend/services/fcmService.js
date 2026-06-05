
const tokenRegistry = new Map();

let firebaseAdmin = null;
let fbInitAttempted = false;

const getFirebaseAdmin = () => {
    if (fbInitAttempted) return firebaseAdmin;
    fbInitAttempted = true;

    try {
        const admin = require('firebase-admin');
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!serviceAccountJson) {
            console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON env var not set — FCM push disabled');
            return null;
        }
        const serviceAccount = JSON.parse(serviceAccountJson);
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }
        firebaseAdmin = admin;
        console.info('[FCM] Firebase Admin initialised');
    } catch (err) {
        console.warn('[FCM] firebase-admin not available or invalid config — FCM push disabled:', err.message);
        firebaseAdmin = null;
    }
    return firebaseAdmin;
};

/**
 * Register a device FCM token for a user profile.
 * @param {number|string} profileId
 * @param {string} token  FCM registration token
 * @param {string} [platform]  'android' | 'ios' | 'web'
 */
const registerToken = (profileId, token, platform = 'android') => {
    if (!profileId || !token) return;
    tokenRegistry.set(String(profileId), { token, platform });
};

/**
 * Remove FCM token for a user (e.g. on logout).
 * @param {number|string} profileId
 */
const removeToken = (profileId) => {
    tokenRegistry.delete(String(profileId));
};

/**
 * Send a push notification to a single user.
 * Silently no-ops if: token not registered, firebase-admin not available, or FCM returns error.
 * @param {number|string} profileId
 * @param {{ title: string, body: string, data?: object }} payload
 */
const sendNotification = async (profileId, { title, body, data = {} }) => {
    const entry = tokenRegistry.get(String(profileId));
    if (!entry) return;

    const admin = getFirebaseAdmin();
    if (!admin) return;

    try {
        await admin.messaging().send({
            token: entry.token,
            notification: { title, body },
            data: Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)]),
            ),
            android:  { priority: 'high' },
            apns:     { payload: { aps: { sound: 'default' } } },
        });
    } catch (err) {
        // Token may be stale — clean up
        if (err.code === 'messaging/registration-token-not-registered') {
            tokenRegistry.delete(String(profileId));
        }
        // Never throw — FCM failures must not crash the main flow
    }
};

/**
 * Send a push notification to multiple users.
 * @param {Array<number|string>} profileIds
 * @param {{ title: string, body: string, data?: object }} payload
 */
const sendToMany = (profileIds, payload) => {
    const ids = [...new Set((profileIds ?? []).filter(Boolean).map(String))];
    return Promise.all(ids.map((id) => sendNotification(id, payload)));
};

module.exports = { registerToken, removeToken, sendNotification, sendToMany };
