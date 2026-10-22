# Runbook deploy — Quản trị xem + xuất danh sách/sĩ số theo buổi

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Đưa VPS lên `main` sau khi merge PR #33: Quản trị xem và xuất Excel danh sách + sĩ số **theo từng buổi** của mọi lớp (đã tính đổi buổi: phân lớp − đổi ra + đổi vào), qua nút **"Theo buổi"** ở dòng lớp trong Chi tiết khóa.

Lần deploy gồm **mọi commit chưa deploy** trên `main`. Prod gần nhất ghi nhận: `dcd9d49` (2026-10-20). Từ đó tới PR #33, mọi commit đều **không migration** (`git diff dcd9d49 origin/main -- backend/prisma` rỗng):

| Commit | Nội dung | Ảnh hưởng dữ liệu |
|---|---|---|
| `ea6ff15`, `c4557c8` | Đổi buổi: lọc + tải lại màn duyệt, hủy duyệt tải lại | Không |
| `17ea6a1` | Nhu cầu mức: hướng dẫn pptx, nhãn trên màn hẹp | Không |
| `f44208b` | Thêm số buổi đã học vào Excel nhu cầu theo đợt | Không |
| PR #33 | 3 route mới `GET /lop/:id/buoi`, `/lop/:id/buoi/:lichId/hoc-vien`, `/lop/:id/buoi/xuat` (chỉ `quan_tri`); nhật ký mới `xuat_danh_sach_buoi` | **Không migration**, không sửa/xóa dòng nào; chỉ đọc + ghi thêm nhật ký khi xuất |

Không đổi `.env`. Không prefix Nginx mới (`/lop` đã được proxy) → **không cần** reload Nginx. Gián đoạn: backend 3–5 giây lúc `pm2 reload`. Dự kiến 5–10 phút; nên làm ngoài giờ học (sau 22h).

Mọi lệnh chạy trên VPS bằng user thường (không sudo). Repo: `~/apps/boi-duong-nls`.

---

## 0. Merge PR (máy dev / GitHub)

Merge PR #33 vào `main` (nút Merge trên GitHub, hoặc `gh pr merge 33 --merge`). Kiểm tra `main` trên GitHub có commit `feat(lop-theo-buoi)…`.

## 1. Ghi lại trạng thái + backup

Không có migration nhưng vẫn backup (thói quen an toàn, rẻ):

```bash
cd ~/apps/boi-duong-nls
git log -1 --oneline | tee ~/truoc-deploy-ds-theo-buoi-$(date +%F).txt     # commit prod hiện tại — cần cho quay lui
git status --short
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
mkdir -p ~/backups/postgres
F=~/backups/postgres/truoc-ds-theo-buoi-$(date +%F-%H%M).dump
(umask 077; pg_dump "$DB_URL" -Fc -f "$F") && ls -lh "$F"
test -s "$F" || { echo "Dump rỗng — DỪNG"; exit 1; }
unset DB_URL
```

Mật khẩu lấy từ `DATABASE_URL` trong `backend/.env` — **không** dùng `-U`. `git status` có file sửa trên VPS → `git stash` trước bước 2, `git stash pop` sau đó.

## 2. Kéo code + xác nhận KHÔNG có migration chờ

```bash
git pull origin main && git log --oneline -1
cd backend && npx prisma migrate status
```

Kỳ vọng: `Database schema is up to date!` (không migration chờ). Nếu báo có migration chờ hoặc drift → **DỪNG**, báo lại (lần này không được có migration nào).

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-ds-theo-buoi-$(date +%F-%H%M).log
```

Script: `npm ci` → `prisma generate` → build → backup tự động (nếu đã cài) → `prisma migrate deploy` (không có gì để áp) → seed (idempotent) → `pm2 reload` → build + chép frontend. Dòng "Kiem tra Nginx da proxy du moi prefix" phải là `OK`.

## 4. Kiểm tra sau deploy

```bash
# Route mới tồn tại: không token -> 401 (nếu 404 là backend chưa có code mới)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/lop/00000000-0000-4000-8000-000000000000/buoi
pm2 logs boiduongnls-backend --lines 100 --nostream
```

- `curl` trả `401` → đúng. Trả `404` → code mới chưa chạy, xem lại log deploy.
- `pm2 logs` không có lỗi lặp lại.
- Trên web, đăng nhập Quản trị → **Khóa bồi dưỡng** → mở 1 khóa → dòng lớp có nút **"Theo buổi"** → chọn buổi: sĩ số trong ô chọn buổi, người "Đổi vào" (nền xanh), mục "Đã chuyển sang lớp khác". Bấm **Xuất buổi này** / **Xuất tất cả buổi** → tải được `ds-buoi-<yyyymmdd>.xlsx` (1 sheet/buổi).
- Tài khoản người hỗ trợ học viên: tab "Theo buổi" ở trang lớp vẫn chạy như cũ.
- (Tuỳ chọn) Nhật ký: Quản trị → Nhật ký, lọc "Xuất danh sách theo buổi (có ngày sinh)" thấy lần xuất vừa làm.

## 5. Quay lui (nếu cần)

Không có thay đổi schema/dữ liệu → **chỉ quay lui code**, không cần restore DB:

- Trên máy dev: `git revert -m 1 <merge-commit-PR-33>` rồi push `main`.
- Trên VPS: `cd ~/apps/boi-duong-nls && git pull origin main && cd scripts/vps && bash 06-deploy.sh`.

Dòng nhật ký `xuat_danh_sach_buoi` đã ghi vẫn nằm lại trong `nhat_ky_hoat_dong` — vô hại với code cũ. Chỉ restore từ dump bước 1 khi có bằng chứng dữ liệu sai (không kỳ vọng xảy ra).

## 6. Sau deploy

- [ ] Ghi commit đã deploy vào ghi chú dự án.
- [ ] Báo Quản trị: sĩ số đúng theo buổi xem ở nút "Theo buổi"; cột "Sĩ số hiện tại" của bảng lớp vẫn chỉ đếm phân lớp (không tính đổi buổi).
