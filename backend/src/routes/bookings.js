const express = require('express');
const { HttpError } = require('../errors');
const R = require('../rules');

module.exports = (db, auth) => {
  const r = express.Router();

  // POST /api/bookings  { court_id, date, hour }   (US-05)
  r.post('/', auth.authRequired, (req, res) => {
    const courtId = Number(req.body.court_id);
    const hour = Number(req.body.hour);
    const date = req.body.date;
    if (!Number.isInteger(courtId) || !Number.isInteger(hour) || !R.isValidDate(date))
      throw new HttpError(400, 'Dữ liệu đặt sân không hợp lệ');
    if (hour < R.OPEN_HOUR || hour >= R.CLOSE_HOUR)
      throw new HttpError(400, 'Sân chỉ nhận đặt từ 06:00 đến 22:00');

    const court = db.prepare('SELECT * FROM courts WHERE id=?').get(courtId);
    if (!court) throw new HttpError(404, 'Không tìm thấy sân');
    if (!court.active) throw new HttpError(409, 'Sân đang tạm ngưng nhận đặt'); // BR-06

    if (R.hoursUntilSlot(date, hour) <= 0) throw new HttpError(400, 'Không thể đặt khung giờ đã qua'); // BR-03
    if (date > R.addDays(R.todayVN(), R.MAX_DAYS_AHEAD))
      throw new HttpError(400, `Chỉ được đặt trước tối đa ${R.MAX_DAYS_AHEAD} ngày`);

    // BR-05: giới hạn số lượt đang hiệu lực (đã đặt và chưa tới giờ chơi)
    const active = db.prepare("SELECT booking_date,hour FROM bookings WHERE user_id=? AND status='booked'")
      .all(req.user.id).filter((b) => R.hoursUntilSlot(b.booking_date, b.hour) > 0).length;
    if (active >= R.MAX_ACTIVE_BOOKINGS)
      throw new HttpError(409, `Bạn đang có ${active} lượt đặt, tối đa ${R.MAX_ACTIVE_BOOKINGS}. Hãy hủy bớt hoặc chờ đến giờ chơi`);

    try {
      const info = db.prepare(
        'INSERT INTO bookings (user_id,court_id,booking_date,hour,price) VALUES (?,?,?,?,?)'
      ).run(req.user.id, courtId, date, hour, court.price_per_hour);
      res.status(201).json({ id: info.lastInsertRowid, court_id: courtId, date, hour, price: court.price_per_hour, status: 'booked' });
    } catch (e) {
      // BR-02: unique index chặn trùng giờ -> báo lỗi thân thiện thay vì lỗi 500
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'Khung giờ này vừa có người đặt');
      throw e;
    }
  });

  // GET /api/bookings/mine   (US-06)
  r.get('/mine', auth.authRequired, (req, res) => {
    const rows = db.prepare(`
      SELECT b.id, b.booking_date AS date, b.hour, b.price, b.status, c.name AS court_name, c.type AS court_type
      FROM bookings b JOIN courts c ON c.id = b.court_id
      WHERE b.user_id=? ORDER BY b.id DESC`).all(req.user.id);
    res.json(rows.map((b) => ({
      ...b,
      label: R.slotLabel(b.hour),
      can_cancel: b.status === 'booked' && R.hoursUntilSlot(b.date, b.hour) >= R.MIN_CANCEL_HOURS,
    })));
  });

  // POST /api/bookings/5/cancel   (US-07)
  r.post('/:id/cancel', auth.authRequired, (req, res) => {
    const b = db.prepare('SELECT * FROM bookings WHERE id=? AND user_id=?').get(Number(req.params.id), req.user.id);
    if (!b) throw new HttpError(404, 'Không tìm thấy lượt đặt'); // lượt của người khác cũng báo 404
    if (b.status !== 'booked') throw new HttpError(409, 'Lượt đặt này đã được hủy trước đó');
    if (R.hoursUntilSlot(b.booking_date, b.hour) < R.MIN_CANCEL_HOURS)
      throw new HttpError(400, `Chỉ hủy được khi còn ít nhất ${R.MIN_CANCEL_HOURS} giờ trước giờ chơi`); // BR-04
    db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(b.id);
    res.json({ id: b.id, status: 'cancelled' });
  });
  return r;
};
