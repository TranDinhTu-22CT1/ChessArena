# Chess Arena

Project gồm 2 folder:

- `Frontend`: React + Vite, giao diện web cờ vua.
- `backend`: Next.js, API backend.

## Chạy local

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd Frontend
npm install
npm run dev
```

Mặc định:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Env

Mỗi folder có sẵn `.env` và `.env.example`.

- `Frontend/.env`: cấu hình `VITE_API_URL`
- `backend/.env`: cấu hình `FRONTEND_URL`

## Match Logs

Khi backend local đang chạy, frontend sẽ gửi log ván cờ về:

- `backend/logs/<gameId>.pgn`: PGN/SAN theo chuẩn cờ vua để xem lại ván.
- `backend/logs/<gameId>.json`: FEN hiện tại, move list chi tiết, SAN/LAN, capture, promotion.

Frontend khong luu phien, token hay log van dau trong trinh duyet; phien dang nhap duoc bao ve bang cookie HttpOnly phia backend.

## Supabase

Backend hỗ trợ ghi log vào Supabase. Chạy SQL trong `backend/supabase/schema.sql` bằng Supabase SQL Editor để tạo bảng:

- `users`: tài khoản local của người chơi.
- `games`: metadata, FEN, PGN, kết quả ván.
- `game_moves`: từng nước đi theo SAN/LAN.

Thêm các biến này vào `backend/.env`:

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào frontend.

## Deploy Vercel sau này

Có thể deploy riêng 2 project:

- `backend` deploy như Next.js project.
- `Frontend` deploy như Vite project, đặt `VITE_API_URL` trỏ về domain backend.
