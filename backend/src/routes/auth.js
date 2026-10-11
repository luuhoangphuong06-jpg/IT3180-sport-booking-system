const express = require('express');
const bcrypt = require('bcryptjs');
const { HttpError } = require('../errors');
const R = require('../rules');

module.exports = (db, auth) => {
  const r = express.Router();

  // POST /api/auth/register  { name, email, password }
  r.post('/register', (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name) throw new HttpError(400, 'Vui lòng nhập họ tên');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ');
    if (password.length < R.MIN_PASSWORD_LENGTH)
      throw new HttpError(400, `Mật khẩu cần ít nhất ${R.MIN_PASSWORD_LENGTH} ký tự`);
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email))
      throw new HttpError(409, 'Email này đã được đăng ký');

    const hash = bcrypt.hashSync(password, 10); // BR-07: không bao giờ lưu mật khẩu thô
    const info = db.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)').run(name, email, hash);
    const user = { id: info.lastInsertRowid, name, email, role: 'player' };
    res.status(201).json({ token: auth.signToken(user), user });
  });

  // POST /api/auth/login  { email, password }
  r.post('/login', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const row = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    // US-02: không tiết lộ là sai email hay sai mật khẩu
    if (!row || !bcrypt.compareSync(String(req.body.password || ''), row.password_hash))
      throw new HttpError(401, 'Email hoặc mật khẩu không đúng');
    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    res.json({ token: auth.signToken(user), user });
  });

  r.get('/me', auth.authRequired, (req, res) => res.json({ user: req.user }));
  return r;
};
