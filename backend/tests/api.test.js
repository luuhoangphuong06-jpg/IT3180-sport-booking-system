const test = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');
const R = require('../src/rules');

// Mỗi lần chạy dùng DB trong bộ nhớ -> test không đụng dữ liệu thật.
const db = openDb(':memory:');
db.prepare("INSERT INTO courts (name,type,price_per_hour) VALUES ('Sân 1','football',300000)").run();
db.prepare("INSERT INTO courts (name,type,price_per_hour) VALUES ('Sân 2','badminton',80000)").run();
const adminHash = require('bcryptjs').hashSync('admin12345', 4);
db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES ('Admin','admin@t.com',?, 'admin')").run(adminHash);

let server, base;
test.before(() => new Promise((ok) => {
  server = createApp(db).listen(0, () => { base = `http://localhost:${server.address().port}/api`; ok(); });
}));
test.after(() => server.close());

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
const register = async (n) => (await call('POST', '/auth/register', { name: n, email: `${n}@t.com`, password: 'matkhau123' })).data.token;
const tomorrow = R.addDays(R.todayVN(), 1);

test('đăng ký: email trùng và mật khẩu ngắn bị từ chối', async () => {
  await register('an');
  assert.strictEqual((await call('POST', '/auth/register', { name: 'x', email: 'an@t.com', password: 'matkhau123' })).status, 409);
  assert.strictEqual((await call('POST', '/auth/register', { name: 'x', email: 'b@t.com', password: '123' })).status, 400);
});

test('đăng nhập sai không tiết lộ sai ở đâu', async () => {
  const a = await call('POST', '/auth/login', { email: 'an@t.com', password: 'saisai123' });
  const b = await call('POST', '/auth/login', { email: 'khongco@t.com', password: 'saisai123' });
  assert.strictEqual(a.status, 401);
  assert.strictEqual(a.data.error, b.data.error);
});

test('đặt sân thành công, rồi trùng giờ bị chặn', async () => {
  const t1 = await register('binh'), t2 = await register('cuong');
  const ok = await call('POST', '/bookings', { court_id: 1, date: tomorrow, hour: 18 }, t1);
  assert.strictEqual(ok.status, 201);
  const dup = await call('POST', '/bookings', { court_id: 1, date: tomorrow, hour: 18 }, t2);
  assert.strictEqual(dup.status, 409);
  const slots = await call('GET', `/courts/1/slots?date=${tomorrow}`, null, t1);
  const s18 = slots.data.slots.find((s) => s.hour === 18);
  assert.deepStrictEqual([s18.status, s18.mine], ['booked', true]);
});

test('2 người bấm đồng thời: đúng 1 người đặt được (NFR tính đúng đắn)', async () => {
  const t1 = await register('dung'), t2 = await register('em');
  const rs = await Promise.all([
    call('POST', '/bookings', { court_id: 2, date: tomorrow, hour: 7 }, t1),
    call('POST', '/bookings', { court_id: 2, date: tomorrow, hour: 7 }, t2),
  ]);
  assert.deepStrictEqual(rs.map((r) => r.status).sort(), [201, 409]);
  const n = db.prepare("SELECT COUNT(*) n FROM bookings WHERE court_id=2 AND hour=7 AND status='booked'").get().n;
  assert.strictEqual(n, 1);
});

test('từ chối: giờ đã qua, quá 7 ngày, giờ ngoài 6-22, chưa đăng nhập', async () => {
  const t = await register('giang');
  const yesterday = R.addDays(R.todayVN(), -1);
  assert.strictEqual((await call('POST', '/bookings', { court_id: 1, date: yesterday, hour: 10 }, t)).status, 400);
  assert.strictEqual((await call('POST', '/bookings', { court_id: 1, date: R.addDays(R.todayVN(), 8), hour: 10 }, t)).status, 400);
  assert.strictEqual((await call('POST', '/bookings', { court_id: 1, date: tomorrow, hour: 22 }, t)).status, 400);
  assert.strictEqual((await call('POST', '/bookings', { court_id: 1, date: tomorrow, hour: 10 })).status, 401);
});

test('tối đa 3 lượt đang hiệu lực (BR-05)', async () => {
  const t = await register('hoa');
  for (const h of [8, 9, 10]) assert.strictEqual((await call('POST', '/bookings', { court_id: 1, date: tomorrow, hour: h }, t)).status, 201);
  assert.strictEqual((await call('POST', '/bookings', { court_id: 1, date: tomorrow, hour: 11 }, t)).status, 409);
});

test('hủy: chủ lượt hủy được, giờ được trả lại, người khác không hủy được', async () => {
  const t1 = await register('khang'), t2 = await register('linh');
  const b = (await call('POST', '/bookings', { court_id: 2, date: tomorrow, hour: 15 }, t1)).data;
  assert.strictEqual((await call('POST', `/bookings/${b.id}/cancel`, null, t2)).status, 404);
  assert.strictEqual((await call('POST', `/bookings/${b.id}/cancel`, null, t1)).status, 200);
  assert.strictEqual((await call('POST', `/bookings/${b.id}/cancel`, null, t1)).status, 409);
  assert.strictEqual((await call('POST', '/bookings', { court_id: 2, date: tomorrow, hour: 15 }, t2)).status, 201);
});

test('chỉ admin gọi được API quản trị, kể cả gọi thẳng', async () => {
  const player = await register('nam2');
  const body = { name: 'Sân mới', type: 'tennis', price_per_hour: 100000 };
  assert.strictEqual((await call('POST', '/admin/courts', body)).status, 401);
  assert.strictEqual((await call('POST', '/admin/courts', body, player)).status, 403);
  const admin = (await call('POST', '/auth/login', { email: 'admin@t.com', password: 'admin12345' })).data.token;
  assert.strictEqual((await call('POST', '/admin/courts', body, admin)).status, 201);
  assert.strictEqual((await call('POST', '/admin/courts', { ...body, type: 'golf' }, admin)).status, 400);
});

test('sân bị ẩn: không hiện trong danh sách và không nhận đặt (BR-06)', async () => {
  const admin = (await call('POST', '/auth/login', { email: 'admin@t.com', password: 'admin12345' })).data.token;
  await call('PUT', '/admin/courts/2', { name: 'Sân 2', type: 'badminton', price_per_hour: 80000, active: false }, admin);
  const list = await call('GET', '/courts');
  assert.ok(!list.data.some((c) => c.id === 2));
  const t = await register('oanh');
  assert.strictEqual((await call('POST', '/bookings', { court_id: 2, date: tomorrow, hour: 20 }, t)).status, 409);
});
