const express = require('express');
const path = require('path');
const { HttpError } = require('./errors');
const makeAuth = require('./auth');

// Tách createApp ra khỏi server.js để file test dùng được (DB giả trong bộ nhớ).
function createApp(db) {
  const app = express();
  const auth = makeAuth(db);
  app.use(express.json());

  app.use('/api/auth', require('./routes/auth')(db, auth));
  app.use('/api/courts', require('./routes/courts')(db, auth));
  app.use('/api/bookings', require('./routes/bookings')(db, auth));
  app.use('/api/admin', require('./routes/admin')(db, auth));
  app.use('/api', (_req, _res) => { throw new HttpError(404, 'Không có API này'); });

  // Frontend: Express phục vụ luôn thư mục frontend/ -> cùng 1 địa chỉ, khỏi lo CORS.
  app.use(express.static(path.join(__dirname, '../../frontend')));

  // Bộ xử lý lỗi chung: mọi lỗi ra cùng định dạng { error: "..." }.
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: 'Yêu cầu không hợp lệ' });
    console.error(err);
    res.status(500).json({ error: 'Lỗi hệ thống, thử lại sau' });
  });
  return app;
}
module.exports = { createApp };
