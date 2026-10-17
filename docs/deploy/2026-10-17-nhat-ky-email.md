# Runbook deploy — Nhật ký email cho Quản trị (+ DS học viên theo buổi ở cổng giảng viên)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Prod lúc soạn: `bddc4f7`. Lần deploy này mang lên 2 thay đổi trên `main`:

| Commit | Nội dung | Ảnh hưởng dữ liệu |
|---|---|---|
| `abbebe6` | Danh sách học viên theo buổi ở cổng giảng viên + hồ sơ lớp hỗ trợ GV | **KHÔNG migration** |
| `45c06ca` (merge `b73aa25`) | Trang **Nhật ký email** `/admin/nhat-ky-email` (chỉ `quan_tri`): thẻ số liệu hàng đợi/hạn mức; tab Nhật ký gửi (lọc loại, trạng thái, tìm email/tiêu đề); tab Hàng đợi email + xem nội dung HTML (iframe sandbox) | **KHÔNG migration**, chỉ đọc `nhat_ky_thong_bao`, `hang_doi_email`. Không đổi `.env`, không đổi Nginx (prefix `thong-bao` đã có) |

Lưu ý bảo mật: nội dung email **kích hoạt tài khoản đơn vị** trong hàng đợi chứa link có token — chỉ Quản trị xem được, không chụp màn hình gửi ra ngoài.

## 1. Ghi lại trạng thái

```bash
cd ~/apps/boi-duong-nls && git rev-parse --short HEAD | tee ~/truoc-deploy-nhat-ky-email-$(date +%F).txt && git status --short
```

Kỳ vọng: `bddc4f7`, `git status` rỗng. Không có migration nên không bắt buộc backup tay (06-deploy.sh vẫn tự backup trước bước migrate nếu đã chạy 07-setup-backup.sh).

## 2. Kéo code + kiểm tra migration

```bash
git pull origin main && git log --oneline -3 && cd backend && npx prisma migrate status
```

Kỳ vọng: "Database schema is up to date". Có migration chờ → **DỪNG**, đối chiếu lại commit vừa kéo.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps && bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

Script không tự reload Nginx được (cần sudo) thì chạy thêm:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Kiểm tra

- `pm2 logs boiduongnls-backend --lines 100 --nostream` không có lỗi lặp lại.
- Đăng nhập Quản trị (Ctrl+F5) → menu **Nhật ký email**: 5 thẻ số liệu có số; tab Nhật ký gửi có dòng; lọc "Lịch giảng dạy (giảng viên)" ra email ADR 0009; tab Hàng đợi email → **Xem** mở được nội dung.
- Tài khoản Sở/Trường **không** thấy mục Nhật ký email.
- Cổng giảng viên: danh sách học viên theo buổi hiển thị bình thường.

## 5. Quay lui

Revert 2 commit trên `main` (hoặc `git checkout bddc4f7` tạm thời), `git pull` + `06-deploy.sh`. Không có gì cần đảo ở DB.
