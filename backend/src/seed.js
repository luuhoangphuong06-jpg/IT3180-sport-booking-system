// npm run seed  (server cũng tự seed khi DB trống, file này để chạy tay)
const path = require('path');
const { openDb, seedIfEmpty } = require('./db');
seedIfEmpty(openDb(process.env.DB_FILE || path.join(__dirname, '../data/app.db')));
console.log('Đã seed (nếu DB còn trống).');
