const { ipKeyGenerator } = require('express-rate-limit');

/**
 * IP thật của client.
 *
 * Production đi client → Cloudflare → proxy của Render → Node. `trust proxy 1` chỉ bóc
 * được một lớp, nên req.ip là IP của máy chủ Cloudflare đã chuyển request chứ không phải
 * của người dùng. Log thật: cùng một phiên admin hiện ra dưới 3 IP khác nhau trong 3 giây,
 * và một IP Cloudflare phục vụ cùng lúc cả trình duyệt admin lẫn app tài xế trên iPhone.
 * Mọi trần "theo IP" khi đó là trần chung cho tất cả người dùng đi qua cùng máy Cloudflare.
 *
 * Cloudflare GHI ĐÈ header CF-Connecting-IP bằng IP thật ở mọi request, nên client không
 * tự đặt được. Không có header (chạy local, test) thì lùi về req.ip như cũ.
 *
 * KHÔNG nâng `trust proxy` lên 2, 3 để "bóc thêm lớp": Render không công bố có bao nhiêu
 * lớp proxy, đặt thừa một lớp là client tự điền X-Forwarded-For để né rate limit.
 */
const clientIp = (req) => req.headers['cf-connecting-ip'] || req.ip;

/**
 * Khoá rate limit theo IP thật. Phải đi qua ipKeyGenerator: IPv6 được gộp theo dải /56,
 * không thì một máy có cả dải IPv6 chỉ cần đổi địa chỉ mỗi request là thoát trần.
 */
const rateLimitKey = (req) => ipKeyGenerator(clientIp(req));

module.exports = { clientIp, rateLimitKey };
