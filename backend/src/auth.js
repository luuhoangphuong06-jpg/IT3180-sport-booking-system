const jwt = require('jsonwebtoken');
const { HttpError } = require('./errors');

const SECRET = process.env.JWT_SECRET || 'dev-secret-doi-khi-deploy';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('Thiếu biến môi trường JWT_SECRET khi chạy production');
}

const signToken = (user) => jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' });

// Middleware = hàm chạy TRƯỚC handler của route. Ở đây: đọc token -> gắn req.user.
module.exports = (db) => {
  const load = (req) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) return null;
    try {
      const { id } = jwt.verify(m[1], SECRET);
      return db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(id) || null;
    } catch { return null; }
  };
  return {
    signToken,
    optionalAuth(req, _res, next) { req.user = load(req); next(); },
    authRequired(req, _res, next) {
      req.user = load(req);
      if (!req.user) throw new HttpError(401, 'Bạn cần đăng nhập');
      next();
    },
    adminRequired(req, _res, next) {
      req.user = load(req);
      if (!req.user) throw new HttpError(401, 'Bạn cần đăng nhập');
      if (req.user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị viên được thực hiện');
      next();
    },
  };
};
