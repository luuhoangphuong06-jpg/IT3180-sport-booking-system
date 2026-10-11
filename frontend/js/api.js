// Lớp "giao tiếp với backend". Mọi lời gọi REST API đi qua hàm api() này.
// Trình duyệt gửi:  fetch('/api/courts')  ->  Express nhận  ->  SQLite  ->  trả JSON về.

const Session = {
  get token() { return localStorage.getItem('token'); },
  get user() {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  },
  save(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  clear() { localStorage.removeItem('token'); localStorage.removeItem('user'); },
};

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (Session.token) headers.Authorization = 'Bearer ' + Session.token; // đính kèm "thẻ" đăng nhập
  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Có lỗi xảy ra, thử lại sau');
    err.status = res.status;
    throw err;
  }
  return data;
}
