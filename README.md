# Web app điều khiển PC từ xa

Gồm 3 phần:
- `server/` — server trung gian, deploy 1 lần lên Internet (Railway/Render).
- `agent/` — chạy trên PC Windows bạn muốn điều khiển.
- `web/` — trang web để xem/điều khiển (server tự phục vụ trang này luôn, không cần deploy riêng).

## Bước 1 — Deploy server (làm 1 lần)

1. Tạo tài khoản miễn phí tại https://railway.app (hoặc https://render.com).
2. Tạo repo GitHub mới, đẩy toàn bộ thư mục `server/` lên đó (hoặc cả project này).
3. Trên Railway: **New Project → Deploy from GitHub repo** → chọn repo → chọn thư mục gốc là `server` (Root Directory = `server`) → Deploy.
4. Sau khi deploy xong, Railway cho bạn 1 URL dạng `https://xxxx.up.railway.app`. Đây chính là `SERVER_URL`.

> Không có GitHub? Có thể cài Railway CLI và chạy `railway up` ngay trong thư mục `server/` — nói mình biết nếu bạn muốn hướng dẫn cách này.

## Bước 2 — Cài agent trên PC Windows cần điều khiển

1. Cài Node.js (bản LTS) tại https://nodejs.org nếu máy chưa có.
2. Copy thư mục `agent/` vào PC đó.
3. Trong thư mục `agent/`, copy file `.env.example` thành `.env`, mở bằng Notepad, điền:
   ```
   SERVER_URL=https://xxxx.up.railway.app   (URL ở Bước 1)
   PASSWORD=matkhaucuaban                    (tuỳ chọn, nên đặt cho an toàn)
   ```
4. Double-click file **`start-agent.bat`**. Lần đầu nó sẽ tự cài thư viện (mất khoảng 1-2 phút), sau đó hiện ra một **mã 6 ký tự** — đây là mã để kết nối.
5. Giữ cửa sổ này mở (thu nhỏ cũng được) — PC chỉ điều khiển được khi agent đang chạy.

## Bước 3 — Điều khiển từ điện thoại/máy khác

1. Mở trình duyệt, vào đúng `SERVER_URL` (URL ở Bước 1).
2. Nhập mã 6 ký tự hiện trên PC + mật khẩu (nếu có đặt).
3. Bấm **Kết nối** — màn hình PC sẽ hiện ra, chạm/click để điều khiển chuột, gõ bàn phím vật lý (điện thoại nên dùng chuột Bluetooth hoặc bàn phím rời để dễ thao tác).

## Lưu ý bảo mật

- Luôn đặt `PASSWORD` trong `.env` — nếu không, ai đoán được mã 6 ký tự cũng điều khiển được PC bạn.
- Mã kết nối chỉ tồn tại khi agent đang chạy, và đổi mới mỗi lần khởi động lại agent.
- Đây là bản MVP (dùng để quản trị/hỗ trợ từ xa) — độ trễ/khung hình phụ thuộc vào tốc độ mạng, chưa tối ưu cho việc xem video/chơi game.
