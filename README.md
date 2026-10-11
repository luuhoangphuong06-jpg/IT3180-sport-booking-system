# Đặt sân thể thao (MVP)

Web đặt sân: xem sân, xem giờ trống theo ngày, đặt/hủy sân, trang quản trị cho chủ sân.

## 1. Cài công cụ (mỗi thành viên làm 1 lần)

| Công cụ | Dùng để | Tải về |
|---|---|---|
| **VS Code** | Viết code (cả frontend lẫn backend) | code.visualstudio.com |
| **Node.js 20+ (LTS)** | Chạy backend (JavaScript ngoài trình duyệt) | nodejs.org |
| **Git** + tài khoản **GitHub** | Chia sẻ code cho cả nhóm | git-scm.com |
| **Postman** | Gọi thử API không cần giao diện | postman.com |
| **DB Browser for SQLite** | Mở file database xem dữ liệu | sqlitebrowser.org |
| **Chrome** (F12 → tab Network) | Xem frontend gọi API thế nào | |

Extension VS Code nên cài: *ESLint*, *Prettier*, *GitLens*.

## 2. Chạy dự án

```bash
cd backend
npm install        # tải thư viện (lần đầu)
npm start          # chạy server tại http://localhost:3000
npm run dev        # như trên nhưng tự khởi động lại khi sửa code
npm test           # chạy test tự động
```

Mở trình duyệt vào **http://localhost:3000**. Lần chạy đầu tự tạo database và dữ liệu mẫu:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | admin@example.com | admin12345 |
| Người chơi | nam@example.com | player12345 |

## 3. Các phần liên kết với nhau thế nào

```
 Trình duyệt (frontend/)            Server (backend/src/)                 Database
 HTML + CSS + JS thuần   --HTTP-->  Express: routes/ -> rules.js  --SQL-->  SQLite
 js/api.js gọi fetch()   <--JSON--  kiểm tra luật, phân quyền    <------   file data/app.db
```

- **Frontend → Backend:** `frontend/js/api.js` gọi `fetch('/api/...')`, gửi/nhận **JSON**. Sau đăng nhập, mỗi request kèm header `Authorization: Bearer <token>`.
- **Backend → Database:** `better-sqlite3` chạy câu lệnh SQL trong `routes/*.js`.
- **Vì sao chung một địa chỉ:** Express phục vụ luôn thư mục `frontend/` (xem `app.js`), nên frontend và API cùng `localhost:3000`, không cần cấu hình CORS.

## 4. Cấu trúc thư mục

```
court-booking/
├─ backend/
│  ├─ src/
│  │  ├─ server.js        khởi động server              (Trang)
│  │  ├─ app.js           ghép routes, xử lý lỗi chung  (Hùng)
│  │  ├─ db.js            schema + dữ liệu mẫu           (Trang)
│  │  ├─ rules.js         quy tắc nghiệp vụ BR-01..07    (Minh + Hùng)
│  │  ├─ auth.js          JWT, phân quyền                (Hùng)
│  │  └─ routes/          auth, courts, bookings, admin  (Hùng)
│  └─ tests/              unit test + API test           (Khoa)
├─ frontend/
│  ├─ index.html, css/style.css                          (Lan)
│  └─ js/api.js, js/app.js                               (Lan)
└─ README.md
```

## 5. Danh sách API

| Method | Đường dẫn | Ai gọi | Mô tả |
|---|---|---|---|
| POST | /api/auth/register | Khách | Đăng ký |
| POST | /api/auth/login | Khách | Đăng nhập, nhận token |
| GET | /api/auth/me | Đã đăng nhập | Thông tin của mình |
| GET | /api/courts?type= | Ai cũng được | Danh sách sân (lọc theo loại) |
| GET | /api/courts/:id/slots?date= | Ai cũng được | Khung giờ của 1 sân trong 1 ngày |
| POST | /api/bookings | Người chơi | Đặt sân `{court_id, date, hour}` |
| GET | /api/bookings/mine | Người chơi | Lượt đặt của tôi |
| POST | /api/bookings/:id/cancel | Người chơi | Hủy lượt đặt |
| GET/POST | /api/admin/courts | Admin | Xem tất cả / thêm sân |
| PUT | /api/admin/courts/:id | Admin | Sửa, ẩn/hiện sân |
| GET | /api/admin/bookings?date=&court_id= | Admin | Lượt đặt theo ngày |
| POST | /api/admin/bookings/:id/cancel | Admin | Hủy lượt đặt của khách |

Lỗi luôn có dạng `{ "error": "thông báo tiếng Việt" }` kèm mã HTTP: 400 dữ liệu sai, 401 chưa đăng nhập, 403 không đủ quyền, 404 không thấy, 409 xung đột (trùng giờ, vượt giới hạn).

## 6. Quy trình Git của nhóm

```bash
# Người đầu tiên (Trang): tạo repo trên GitHub rồi
git init && git add . && git commit -m "chore: khởi tạo dự án"
git branch -M main && git remote add origin <url-repo> && git push -u origin main
# Các bạn khác
git clone <url-repo>
```

Quy tắc:
1. **Không commit thẳng vào `main`.** Bật *Branch protection* trên GitHub: cần 1 người review mới được merge.
2. Mỗi việc một nhánh: `feature/dat-san`, `fix/loi-gio-trong`, `docs/srs`.
3. Mỗi ngày làm: `git pull origin main` rồi mới code. Làm xong: `git push`, mở **Pull Request**, nhờ bạn khác review.
4. Tin nhắn commit: `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`.
5. Mỗi người sửa **file của mình** (xem mục 4) để ít xung đột. Cần sửa file người khác thì nhắn trước.

## 7. Biến môi trường (khi deploy)

| Biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng server (mặc định 3000) |
| `JWT_SECRET` | Chuỗi bí mật ký token. **Bắt buộc** khi `NODE_ENV=production` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Tài khoản admin tạo ở lần chạy đầu. **Hãy đổi** khi deploy |
| `DB_FILE` | Đường dẫn file SQLite |

Lưu ý: nhiều nền tảng miễn phí xóa ổ đĩa khi khởi động lại, file SQLite sẽ mất. Khi deploy ta sẽ xử lý (dùng ổ đĩa bền vững hoặc chuyển sang PostgreSQL miễn phí).
