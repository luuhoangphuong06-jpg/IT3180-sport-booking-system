// Toàn bộ QUY TẮC NGHIỆP VỤ (BR-xx trong SRS) nằm ở một chỗ.
// Muốn đổi luật (vd: hủy trước 3 giờ) chỉ sửa ở đây.
const OPEN_HOUR = 6;            // BR-01: mở cửa 06:00
const CLOSE_HOUR = 22;          // BR-01: đóng cửa 22:00 (khung cuối là 21:00-22:00)
const MAX_DAYS_AHEAD = 7;       // BR-03: đặt trước tối đa 7 ngày
const MIN_CANCEL_HOURS = 2;     // BR-04: hủy trước giờ chơi >= 2 giờ
const MAX_ACTIVE_BOOKINGS = 3;  // BR-05: tối đa 3 lượt đang hiệu lực
const MIN_PASSWORD_LENGTH = 8;  // BR-07
const COURT_TYPES = ['football', 'badminton', 'tennis', 'basketball'];

// ---- Thời gian theo giờ Việt Nam (GMT+7) ----
// Mẹo: lấy "đồng hồ treo tường ở VN" rồi coi như UTC để so sánh cho dễ.
const VN_OFFSET_MS = 7 * 3600 * 1000;
const nowVN = () => Date.now() + VN_OFFSET_MS;
const todayVN = (nowMs = nowVN()) => new Date(nowMs).toISOString().slice(0, 10);

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const slotStartMs = (date, hour) => Date.parse(date + 'T00:00:00Z') + hour * 3600 * 1000;
const hoursUntilSlot = (date, hour, nowMs = nowVN()) => (slotStartMs(date, hour) - nowMs) / 3600000;

const pad = (h) => String(h).padStart(2, '0') + ':00';
const slotLabel = (hour) => `${pad(hour)} - ${pad(hour + 1)}`;

module.exports = {
  OPEN_HOUR, CLOSE_HOUR, MAX_DAYS_AHEAD, MIN_CANCEL_HOURS, MAX_ACTIVE_BOOKINGS,
  MIN_PASSWORD_LENGTH, COURT_TYPES,
  nowVN, todayVN, isValidDate, addDays, slotStartMs, hoursUntilSlot, slotLabel,
};
