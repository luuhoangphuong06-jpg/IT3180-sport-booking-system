const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Thiết kế CSDL (ERD): users 1-n bookings n-1 courts
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','admin')),
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL,
  price_per_hour INTEGER NOT NULL CHECK (price_per_hour >= 0),
  active         INTEGER NOT NULL DEFAULT 1            -- 0 = ẩn (BR-06)
);

CREATE TABLE IF NOT EXISTS bookings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  court_id     INTEGER NOT NULL REFERENCES courts(id),
  booking_date TEXT NOT NULL,                          -- 'YYYY-MM-DD'
  hour         INTEGER NOT NULL CHECK (hour BETWEEN 6 AND 21),
  price        INTEGER NOT NULL,                       -- giá chốt lúc đặt
  status       TEXT NOT NULL DEFAULT 'booked'
               CHECK (status IN ('booked','cancelled','admin_cancelled')),
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- BR-02: mỗi khung giờ chỉ có 1 lượt đặt đang hiệu lực.
-- Chốt chặn cuối cùng ở tầng database, kể cả khi 2 người bấm cùng lúc.
CREATE UNIQUE INDEX IF NOT EXISTS ux_active_slot
  ON bookings(court_id, booking_date, hour) WHERE status = 'booked';
`;

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

// Tạo dữ liệu mẫu nếu DB còn trống. Đổi mật khẩu admin bằng biến môi trường khi deploy!
function seedIfEmpty(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;
  const hash = (p) => bcrypt.hashSync(p, 10);
  const addUser = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)');
  addUser.run('Anh Tuấn (chủ sân)', process.env.ADMIN_EMAIL || 'admin@example.com',
    hash(process.env.ADMIN_PASSWORD || 'admin12345'), 'admin');
  addUser.run('Nam', 'nam@example.com', hash('player12345'), 'player');

  const addCourt = db.prepare('INSERT INTO courts (name,type,price_per_hour) VALUES (?,?,?)');
  [
    ['Sân mini 1', 'football', 300000], ['Sân mini 2', 'football', 300000],
    ['Sân mini 3', 'football', 350000], ['Sân cầu lông A', 'badminton', 80000],
    ['Sân cầu lông B', 'badminton', 80000], ['Sân tennis 1', 'tennis', 200000],
  ].forEach((c) => addCourt.run(...c));
}

module.exports = { openDb, seedIfEmpty };
