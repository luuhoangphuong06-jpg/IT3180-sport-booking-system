const test = require('node:test');
const assert = require('node:assert');
const R = require('../src/rules');

// Unit test: hàm thuần, không cần DB hay server.
test('isValidDate', () => {
  assert.ok(R.isValidDate('2026-10-11'));
  assert.ok(!R.isValidDate('2026-02-30'));
  assert.ok(!R.isValidDate('11/10/2026'));
  assert.ok(!R.isValidDate(undefined));
});

test('addDays qua ranh giới tháng/năm', () => {
  assert.strictEqual(R.addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(R.addDays('2026-10-10', 7), '2026-10-17');
});

test('slotLabel', () => assert.strictEqual(R.slotLabel(6), '06:00 - 07:00'));

test('hoursUntilSlot: mốc hủy 2 giờ (BR-04)', () => {
  const now = Date.parse('2026-10-10T16:00:00Z'); // "16:00 giờ VN"
  assert.strictEqual(R.hoursUntilSlot('2026-10-10', 18, now), 2);
  assert.ok(R.hoursUntilSlot('2026-10-10', 17, now) < R.MIN_CANCEL_HOURS);
  assert.ok(R.hoursUntilSlot('2026-10-10', 15, now) < 0);
});
