# Runbook deploy — Yêu cầu hỗ trợ & phạm vi theo lớp (ADR 0011)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

| Nội dung | Ảnh hưởng dữ liệu |
|---|---|
| Người hỗ trợ học viên được gắn **lớp** giờ thấy và trả lời **Yêu cầu hỗ trợ** của học viên lớp mình (lọc "Lớp hỗ trợ"); ký tên "Hỗ trợ lớp X" khi trả lời qua lớp. Phạm vi lớp gồm cả học viên **đổi buổi đã duyệt vào lớp** → học viên chuyển qua lại 2 lớp hiện ở cả 2 nơi. **Tình hình đi học** có bộ chọn "Tất cả · Cụm của tôi · Lớp tôi hỗ trợ" | **KHÔNG migration**, không đổi `.env`, không đổi Nginx. Chỉ đổi cách đọc/quyền. |

Nếu VPS chưa deploy `0d4b640` (chuyên cần dùng chung, học bù/lớp cũ — runbook `2026-10-19-chuyen-can-hoc-bu.md`) thì lần pull này kéo luôn — cũng không migration.

## ⚠️ Lưu ý quyền

- Người hỗ trợ lớp giờ **thấy và trả lời** ticket của học viên lớp mình (kể cả học viên chưa có cụm — trước đây chỉ Quản trị thấy). Người giữ cụm và người giữ lớp cùng thấy 1 ticket → ai trả lời trước được lưu, người sau báo "đã có người trả lời".
- Phạm vi mở rộng áp cho **mọi** chức năng của người hỗ trợ (tra cứu, **sửa hồ sơ, mật khẩu**, báo vắng, tình hình đi học, yêu cầu hỗ trợ) với học viên đổi buổi vào lớp được gắn.

## 1. Ghi lại trạng thái

```bash
cd ~/apps/boi-duong-nls && git rev-parse --short HEAD | tee ~/truoc-deploy-yc-lop-$(date +%F).txt && git status --short
```

Chỉ được thấy `backend/.env.bak-*` chưa theo dõi.

## 2. Kéo code + kiểm tra migration

```bash
git pull origin main && cd backend && npx prisma migrate status
```

Kỳ vọng: "Database schema is up to date". Có migration chờ → **DỪNG**.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps && bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

Dòng `sudo: a password is required` khi reload Nginx là bình thường.

## 4. Kiểm tra

```bash
pm2 logs boiduongnls-backend --lines 50 --nostream --err
```

- Không có lỗi lặp lại.
- Giao diện (Ctrl+F5), tài khoản hỗ trợ **chỉ được gắn lớp** (không cụm):
  1. **Yêu cầu hỗ trợ** → thấy ticket của học viên lớp mình, ô lọc "Lớp hỗ trợ"; trả lời thử 1 ticket → phía học viên ký "Hỗ trợ lớp X".
  2. **Tình hình đi học** → bộ chọn "Lớp tôi hỗ trợ" → thấy cả học viên đổi buổi vào lớp.
- Tài khoản hỗ trợ **cụm** vẫn thấy ticket của cụm như trước.

## 5. Quay lui

Revert commit trên `main`, `git pull` + `06-deploy.sh`. Không có gì cần đảo ở DB (câu trả lời ticket đã gửi giữ nguyên).
