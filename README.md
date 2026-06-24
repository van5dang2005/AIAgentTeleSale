# 🦷 AI Agent Telesale Nha Khoa (Gemini API)

Bot tư vấn & telesale tự động cho phòng khám nha khoa, chạy trên web chat,
sử dụng **Google Gemini** làm bộ não AI, có khả năng:

- Tư vấn dịch vụ, trả lời FAQ nha khoa
- Chủ động khai thác nhu cầu & chốt lịch hẹn (function calling)
- Lưu khách hàng & lịch hẹn vào database SQLite
- API quản trị đơn giản để xem danh sách khách hàng / lịch hẹn

## 1. Cấu trúc dự án

```
dental-telesale-bot/
├── server.js        # Server Express + xử lý chat + function calling
├── agent.js         # System prompt + định nghĩa tools cho Gemini
├── db.js            # Lớp database SQLite (khách hàng, lịch hẹn, hội thoại)
├── package.json
├── .env.example      # Mẫu biến môi trường
└── public/
    └── index.html   # Giao diện chat web
```

## 2. Cài đặt

Yêu cầu: **Node.js >= 18**

```bash
cd dental-telesale-bot
npm install
```

## 3. Cấu hình API key Gemini

1. Lấy API key miễn phí tại: https://aistudio.google.com/app/apikey
2. Copy file mẫu:

```bash
cp .env.example .env
```

3. Mở file `.env` và điền API key cùng thông tin phòng khám:

```env
GEMINI_API_KEY=AIzaSy...your_real_key...
GEMINI_MODEL=gemini-2.0-flash
PORT=3000

CLINIC_NAME=Nha Khoa ABC
CLINIC_ADDRESS=123 Nguyen Van Cu, Quan 1, TP.HCM
CLINIC_HOTLINE=1900 1234
CLINIC_HOURS=8:00 - 20:00 (Thu 2 - Thu 7)
```

## 4. Chạy thử

```bash
npm start
```

Mở trình duyệt tại: **http://localhost:3000**

Bot sẽ tự chào và bạn có thể chat thử ngay, ví dụ:

> "Em muốn tẩy trắng răng, giá bao nhiêu?"
> "Em đặt lịch khám thứ 7 này được không?"

Khi bạn cung cấp đủ **tên, SĐT, dịch vụ, ngày, giờ** và xác nhận, bot sẽ tự
động gọi hàm lưu vào database và xác nhận lại với bạn.

## 5. Xem dữ liệu đã lưu (API quản trị)

| Endpoint | Mô tả |
|---|---|
| `GET /api/admin/customers` | Danh sách khách hàng/lead |
| `GET /api/admin/appointments` | Danh sách lịch hẹn |
| `GET /api/admin/customer/:id/history` | Lịch sử chat của 1 khách |

Database là file SQLite `dental_bot.db` được tạo tự động tại thư mục gốc dự
án — có thể mở bằng [DB Browser for SQLite](https://sqlitebrowser.org/) để
xem trực quan.

## 6. Tùy biến

- **Bảng giá / system prompt**: sửa trong `agent.js` (hàm `buildSystemPrompt`,
  mảng `SERVICES`).
- **Thêm hành động mới** (ví dụ: gửi SMS xác nhận, đẩy qua Zalo OA, ghi vào
  Google Sheets...): thêm function declaration mới trong `tools` (agent.js)
  và xử lý logic tương ứng trong `executeFunctionCall` (server.js).
- **Đổi model Gemini**: sửa biến `GEMINI_MODEL` trong `.env` (ví dụ
  `gemini-2.0-flash`, `gemini-1.5-pro`...).
- **Lưu customerId lâu dài qua nhiều lần truy cập**: trong `public/index.html`,
  thay cơ chế lưu biến JS bằng `localStorage` khi bạn tự host (không dùng
  trong môi trường artifact/demo).

## 7. Lưu ý triển khai thực tế

- Đây là bản nền (MVP) chạy local. Khi triển khai thật, nên:
  - Đặt server sau HTTPS (Nginx/Caddy + domain riêng).
  - Thêm xác thực cho các API `/api/admin/*` (hiện đang public).
  - Cân nhắc chuyển sang PostgreSQL/MySQL nếu lượng dữ liệu lớn.
  - Thêm thông báo (email/SMS/Zalo) cho nhân viên khi có lịch hẹn mới.
  - Review kỹ system prompt theo đúng dịch vụ, chính sách giá thật của
    phòng khám trước khi đưa vào sử dụng với khách hàng thật.
