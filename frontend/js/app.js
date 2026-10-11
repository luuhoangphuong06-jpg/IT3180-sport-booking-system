// Giao diện một trang (SPA): đổi "trang" bằng #/đường-dẫn, không tải lại trình duyệt.
const TYPES = { football: 'Bóng đá', badminton: 'Cầu lông', tennis: 'Tennis', basketball: 'Bóng rổ' };
const STATUS = { booked: 'Đã đặt', cancelled: 'Đã hủy', admin_cancelled: 'Chủ sân đã hủy' };

const view = document.getElementById('view');
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n).toLocaleString('vi-VN') + 'đ';
const fmtDate = (d) => d.split('-').reverse().join('/');
const hh = (h) => String(h).padStart(2, '0') + ':00';
const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD theo giờ máy
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };

let toastTimer;
function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 3200);
}

// Trạng thái nhỏ giữ giữa các lần vẽ lại trang
let filterType = '', selectedDate = null;
let adminTab = 'courts', editingId = null, adminDate = todayStr(), adminCourt = '', adminCourts = [];

/* ---------- Trang: danh sách sân ---------- */
async function courtsView() {
  const courts = await api('GET', '/courts' + (filterType ? '?type=' + filterType : ''));
  view.innerHTML = `
    <h1>Chọn sân</h1>
    <div class="chips">${['', ...Object.keys(TYPES)].map((t) =>
      `<button class="chip${t === filterType ? ' on' : ''}" data-act="type" data-v="${t}">${t ? TYPES[t] : 'Tất cả'}</button>`).join('')}</div>
    <div class="grid">${courts.map((c) => `
      <a class="court t-${c.type}" href="#/court/${c.id}">
        <span class="court-name">${esc(c.name)}</span>
        <span>${TYPES[c.type]}</span>
        <span class="court-price">${money(c.price_per_hour)}<small>/giờ</small></span>
      </a>`).join('') || '<p class="empty">Chưa có sân nào thuộc loại này.</p>'}</div>`;
}

/* ---------- Trang: giờ trống của một sân ---------- */
async function courtView(id) {
  const min = todayStr(), max = addDays(min, 7);
  if (!selectedDate || selectedDate < min || selectedDate > max) selectedDate = min;
  const { court, slots } = await api('GET', `/courts/${id}/slots?date=${selectedDate}`);
  const shown = slots.filter((s) => s.status !== 'past'); // không hiện giờ đã qua (US-04)
  view.innerHTML = `
    <a class="back" href="#/">Quay lại danh sách sân</a>
    <h1>${esc(court.name)}</h1>
    <p class="sub">${TYPES[court.type]}, ${money(court.price_per_hour)}/giờ</p>
    <label class="field">Ngày chơi
      <input type="date" id="date" min="${min}" max="${max}" value="${selectedDate}"></label>
    <div class="slots">${shown.map((s) => {
      const cls = s.mine ? 'mine' : s.status;
      const text = s.mine ? 'Của bạn' : s.status === 'booked' ? 'Đã đặt' : 'Trống';
      return `<button class="slot ${cls}" ${s.status === 'free' ? `data-act="book" data-court="${court.id}" data-hour="${s.hour}"` : 'disabled'}>
        <b>${hh(s.hour)}</b><span>${text}</span></button>`;
    }).join('') || '<p class="empty">Hôm nay đã hết khung giờ. Chọn ngày khác nhé.</p>'}</div>
    <p class="hint">Mỗi ô là 1 giờ. Nhấn vào ô trống để đặt.</p>`;
  $('#date').onchange = (e) => { selectedDate = e.target.value; router(); };
  view.dataset.court = JSON.stringify(court);
}

async function book(courtId, hour) {
  if (!Session.user) {
    sessionStorage.setItem('next', location.hash);
    toast('Hãy đăng nhập để đặt sân');
    location.hash = '#/login';
    return;
  }
  const court = JSON.parse(view.dataset.court);
  if (!confirm(`Đặt ${court.name}\n${hh(hour)} - ${hh(hour + 1)}, ngày ${fmtDate(selectedDate)}\nGiá: ${money(court.price_per_hour)}`)) return;
  try {
    await api('POST', '/bookings', { court_id: courtId, date: selectedDate, hour });
    toast('Đặt sân thành công');
  } catch (e) { toast(e.message, true); }
  router(); // vẽ lại để thấy trạng thái mới (kể cả khi bị người khác đặt trước)
}

/* ---------- Trang: đăng nhập / đăng ký ---------- */
function authView(mode) {
  const reg = mode === 'register';
  view.innerHTML = `
    <h1>${reg ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
    <form id="f" class="form">
      ${reg ? '<label>Họ tên<input name="name" required autocomplete="name"></label>' : ''}
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Mật khẩu${reg ? ' (ít nhất 8 ký tự)' : ''}<input name="password" type="password" required ${reg ? 'minlength="8"' : ''} autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
      <p class="err" id="err"></p>
      <button class="btn">${reg ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
    </form>
    <p class="alt">${reg ? 'Đã có tài khoản? <a href="#/login">Đăng nhập</a>' : 'Chưa có tài khoản? <a href="#/register">Đăng ký</a>'}</p>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('POST', '/auth/' + mode, Object.fromEntries(new FormData(e.target)));
      Session.save(r.token, r.user);
      const next = sessionStorage.getItem('next') || '#/';
      sessionStorage.removeItem('next');
      location.hash = next;
    } catch (err) { $('#err').textContent = err.message; }
  };
}

/* ---------- Trang: lịch của tôi ---------- */
async function myView() {
  if (!Session.user) { sessionStorage.setItem('next', '#/my'); location.hash = '#/login'; return; }
  const list = await api('GET', '/bookings/mine');
  view.innerHTML = `<h1>Lịch của tôi</h1>` + (list.length ? `<ul class="list">${list.map((b) => `
    <li class="row">
      <div><b>${esc(b.court_name)}</b><br>${fmtDate(b.date)}, ${b.label}</div>
      <div class="right">${money(b.price)}<br><span class="tag ${b.status}">${STATUS[b.status]}</span></div>
      ${b.can_cancel ? `<button class="btn ghost" data-act="cancel" data-id="${b.id}">Hủy lượt này</button>` : ''}
    </li>`).join('')}</ul>` : '<p class="empty">Bạn chưa đặt sân nào. <a href="#/">Chọn sân</a></p>');
}

/* ---------- Trang: quản trị ---------- */
async function adminView() {
  if (!Session.user || Session.user.role !== 'admin') { location.hash = '#/'; return; }
  adminCourts = await api('GET', '/admin/courts');
  let body;
  if (adminTab === 'courts') {
    const e = adminCourts.find((c) => c.id === editingId) || { name: '', type: 'football', price_per_hour: '' };
    body = `
      <form id="cf" class="form inline">
        <label>Tên sân<input name="name" required value="${esc(e.name)}"></label>
        <label>Loại<select name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${k === e.type ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Giá/giờ (đ)<input name="price_per_hour" type="number" min="0" step="1000" required value="${e.price_per_hour}"></label>
        <button class="btn">${editingId ? 'Lưu thay đổi' : 'Thêm sân'}</button>
        ${editingId ? '<button type="button" class="btn ghost" data-act="edit-stop">Bỏ qua</button>' : ''}
      </form>
      <ul class="list">${adminCourts.map((c) => `
        <li class="row${c.active ? '' : ' off'}">
          <div><b>${esc(c.name)}</b>${c.active ? '' : ' (đang ẩn)'}<br>${TYPES[c.type]}, ${money(c.price_per_hour)}/giờ</div>
          <div class="actions">
            <button class="btn ghost" data-act="edit" data-id="${c.id}">Sửa</button>
            <button class="btn ghost" data-act="toggle" data-id="${c.id}">${c.active ? 'Ẩn sân' : 'Hiện lại'}</button>
          </div>
        </li>`).join('')}</ul>`;
  } else {
    const rows = await api('GET', `/admin/bookings?date=${adminDate}` + (adminCourt ? '&court_id=' + adminCourt : ''));
    body = `
      <div class="form inline">
        <label>Ngày<input type="date" id="adate" value="${adminDate}"></label>
        <label>Sân<select id="acourt"><option value="">Tất cả</option>${adminCourts.map((c) => `<option value="${c.id}"${String(c.id) === adminCourt ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      </div>
      ${rows.length ? `<div class="scroll"><table><thead><tr><th>Giờ</th><th>Sân</th><th>Khách</th><th>Trạng thái</th><th></th></tr></thead><tbody>
        ${rows.map((b) => `<tr><td>${b.label}</td><td>${esc(b.court_name)}</td><td>${esc(b.user_name)}<br><small>${esc(b.user_email)}</small></td>
          <td><span class="tag ${b.status}">${STATUS[b.status]}</span></td>
          <td>${b.status === 'booked' ? `<button class="btn ghost" data-act="admin-cancel" data-id="${b.id}">Hủy</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">Không có lượt đặt nào trong ngày này.</p>'}`;
  }
  view.innerHTML = `<h1>Quản trị</h1>
    <div class="chips">
      <button class="chip${adminTab === 'courts' ? ' on' : ''}" data-act="tab" data-v="courts">Quản lý sân</button>
      <button class="chip${adminTab === 'bookings' ? ' on' : ''}" data-act="tab" data-v="bookings">Lượt đặt theo ngày</button>
    </div>${body}`;

  if ($('#cf')) $('#cf').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.price_per_hour = Number(data.price_per_hour);
    try {
      if (editingId) {
        const cur = adminCourts.find((c) => c.id === editingId);
        await api('PUT', '/admin/courts/' + editingId, { ...data, active: !!cur.active });
      } else await api('POST', '/admin/courts', data);
      editingId = null; toast('Đã lưu');
    } catch (err) { toast(err.message, true); }
    router();
  };
  if ($('#adate')) $('#adate').onchange = (e) => { adminDate = e.target.value; router(); };
  if ($('#acourt')) $('#acourt').onchange = (e) => { adminCourt = e.target.value; router(); };
}

/* ---------- Xử lý mọi cú nhấn nút có data-act ---------- */
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, v, id, court, hour } = el.dataset;
  try {
    if (act === 'type') { filterType = v; router(); }
    else if (act === 'book') await book(Number(court), Number(hour));
    else if (act === 'cancel') {
      if (!confirm('Hủy lượt đặt này?')) return;
      await api('POST', `/bookings/${id}/cancel`); toast('Đã hủy lượt đặt'); router();
    } else if (act === 'logout') {
      Session.clear();
      if ((location.hash || '#/') === '#/') router(); else location.hash = '#/';
    } else if (act === 'tab') { adminTab = v; router(); }
    else if (act === 'edit') { editingId = Number(id); router(); }
    else if (act === 'edit-stop') { editingId = null; router(); }
    else if (act === 'toggle') {
      const c = adminCourts.find((x) => x.id === Number(id));
      await api('PUT', '/admin/courts/' + c.id, { name: c.name, type: c.type, price_per_hour: c.price_per_hour, active: !c.active });
      router();
    } else if (act === 'admin-cancel') {
      if (!confirm('Hủy lượt đặt của khách?')) return;
      await api('POST', `/admin/bookings/${id}/cancel`); toast('Đã hủy lượt đặt'); router();
    }
  } catch (err) { toast(err.message, true); router(); }
});

/* ---------- Thanh điều hướng + bộ định tuyến ---------- */
function renderNav() {
  const u = Session.user, h = location.hash || '#/';
  const a = (href, text, on) => `<a href="${href}"${on ?? h === href ? ' aria-current="page"' : ''}>${text}</a>`;
  $('#nav').innerHTML = a('#/', 'Sân', h === '#/' || h.startsWith('#/court/')) +
    (u ? a('#/my', 'Lịch của tôi') + (u.role === 'admin' ? a('#/admin', 'Quản trị') : '') +
        '<button data-act="logout">Đăng xuất</button>'
       : a('#/login', 'Đăng nhập') + a('#/register', 'Đăng ký'));
}

const routes = [
  [/^#\/$/, courtsView], [/^#\/court\/(\d+)$/, courtView], [/^#\/login$/, () => authView('login')],
  [/^#\/register$/, () => authView('register')], [/^#\/my$/, myView], [/^#\/admin$/, adminView],
];

async function router() {
  renderNav();
  const hash = location.hash || '#/';
  const hit = routes.find(([re]) => re.test(hash));
  if (!hit) { view.innerHTML = '<p class="empty">Không tìm thấy trang này.</p>'; return; }
  try { await hit[1](...(hash.match(hit[0]) || []).slice(1)); }
  catch (e) {
    if (e.status === 401) { Session.clear(); toast('Phiên đăng nhập đã hết hạn', true); location.hash = '#/login'; return; }
    view.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
  }
}
addEventListener('hashchange', router);
router();
