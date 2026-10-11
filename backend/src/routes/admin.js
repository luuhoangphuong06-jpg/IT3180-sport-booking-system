const express = require('express');
const { HttpError } = require('../errors');
const R = require('../rules');

module.exports = (db, auth) => {
  const r = express.Router();
  r.use(auth.adminRequired); // mọi route trong file này chỉ admin gọi được (NFR bảo mật)

  function readCourt(body) {
    const name = String(body.name || '').trim();
    const price = Number(body.price_per_hour);
    if (!name) throw new HttpError(400, 'Vui lòng nhập tên sân');
    if (!R.COURT_TYPES.includes(body.type)) throw new HttpError(400, 'Loại sân không hợp lệ');
    if (!Number.isInteger(price) || price < 0) throw new HttpError(400, 'Giá/giờ phải là số nguyên không âm');
    return { name, type: body.type, price };
  }

  r.get('/courts', (_req, res) => {
    res.json(db.prepare('SELECT id,name,type,price_per_hour,active FROM courts ORDER BY type,name').all());
  });

  r.post('/courts', (req, res) => {
    const c = readCourt(req.body);
    const info = db.prepare('INSERT INTO courts (name,type,price_per_hour) VALUES (?,?,?)').run(c.name, c.type, c.price);
    res.status(201).json({ id: info.lastInsertRowid, name: c.name, type: c.type, price_per_hour: c.price, active: 1 });
  });

  // Sửa thông tin hoặc ẩn/hiện sân (gửi active: true/false)
  r.put('/courts/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM courts WHERE id=?').get(id)) throw new HttpError(404, 'Không tìm thấy sân');
    const c = readCourt(req.body);
    db.prepare('UPDATE courts SET name=?,type=?,price_per_hour=?,active=? WHERE id=?')
      .run(c.name, c.type, c.price, req.body.active === false ? 0 : 1, id);
    res.json({ id, name: c.name, type: c.type, price_per_hour: c.price, active: req.body.active === false ? 0 : 1 });
  });

  // GET /api/admin/bookings?date=2026-10-11&court_id=1   (US-09)
  r.get('/bookings', (req, res) => {
    let sql = `SELECT b.id, b.booking_date AS date, b.hour, b.price, b.status,
        c.name AS court_name, u.name AS user_name, u.email AS user_email
      FROM bookings b JOIN courts c ON c.id=b.court_id JOIN users u ON u.id=b.user_id WHERE 1=1`;
    const params = [];
    if (req.query.date) {
      if (!R.isValidDate(req.query.date)) throw new HttpError(400, 'Ngày không hợp lệ');
      sql += ' AND b.booking_date=?'; params.push(req.query.date);
    }
    if (req.query.court_id) { sql += ' AND b.court_id=?'; params.push(Number(req.query.court_id)); }
    const rows = db.prepare(sql + ' ORDER BY b.booking_date, b.hour, c.name LIMIT 300').all(...params);
    res.json(rows.map((b) => ({ ...b, label: R.slotLabel(b.hour) })));
  });

  // POST /api/admin/bookings/5/cancel   (US-11)
  r.post('/bookings/:id/cancel', (req, res) => {
    const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(Number(req.params.id));
    if (!b) throw new HttpError(404, 'Không tìm thấy lượt đặt');
    if (b.status !== 'booked') throw new HttpError(409, 'Lượt đặt này không còn hiệu lực');
    db.prepare("UPDATE bookings SET status='admin_cancelled' WHERE id=?").run(b.id);
    res.json({ id: b.id, status: 'admin_cancelled' });
  });
  return r;
};
