const express = require('express');
const { HttpError } = require('../errors');
const R = require('../rules');

module.exports = (db, auth) => {
  const r = express.Router();

  // GET /api/courts?type=football   (ai cũng xem được - US-03, US-10)
  r.get('/', (req, res) => {
    let sql = 'SELECT id,name,type,price_per_hour FROM courts WHERE active=1';
    const params = [];
    if (req.query.type) { sql += ' AND type=?'; params.push(String(req.query.type)); }
    res.json(db.prepare(sql + ' ORDER BY type,name').all(...params));
  });

  // GET /api/courts/1/slots?date=2026-10-11   (US-04)
  r.get('/:id/slots', auth.optionalAuth, (req, res) => {
    const court = db.prepare('SELECT id,name,type,price_per_hour FROM courts WHERE id=? AND active=1')
      .get(Number(req.params.id));
    if (!court) throw new HttpError(404, 'Không tìm thấy sân');

    const date = req.query.date;
    if (!R.isValidDate(date)) throw new HttpError(400, 'Ngày không hợp lệ (dạng YYYY-MM-DD)');
    const today = R.todayVN();
    if (date < today || date > R.addDays(today, R.MAX_DAYS_AHEAD))
      throw new HttpError(400, `Chỉ xem được từ hôm nay đến ${R.MAX_DAYS_AHEAD} ngày tới`);

    const booked = db.prepare(
      "SELECT hour,user_id FROM bookings WHERE court_id=? AND booking_date=? AND status='booked'"
    ).all(court.id, date);
    const owner = new Map(booked.map((b) => [b.hour, b.user_id]));
    const now = R.nowVN();

    const slots = [];
    for (let h = R.OPEN_HOUR; h < R.CLOSE_HOUR; h++) {
      let status = 'free';
      if (R.slotStartMs(date, h) <= now) status = 'past';
      else if (owner.has(h)) status = 'booked';
      slots.push({ hour: h, label: R.slotLabel(h), status, mine: !!req.user && owner.get(h) === req.user.id });
    }
    res.json({ court, date, slots });
  });
  return r;
};
