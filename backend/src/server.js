const path = require('path');
const { openDb, seedIfEmpty } = require('./db');
const { createApp } = require('./app');

const db = openDb(process.env.DB_FILE || path.join(__dirname, '../data/app.db'));
seedIfEmpty(db);

const port = process.env.PORT || 3000;
createApp(db).listen(port, () => console.log(`Chạy tại http://localhost:${port}`));
