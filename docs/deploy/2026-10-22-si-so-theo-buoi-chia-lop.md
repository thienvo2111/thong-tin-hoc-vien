# Runbook deploy — Sheet "Sĩ số theo buổi" trong Excel danh sách chia lớp

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

File `danh-sach-chia-lop-<ma_khoa>.xlsx` (Quản trị → chi tiết khóa → xuất danh sách chia lớp) có thêm sheet **"Sĩ số theo buổi"**: 1 dòng/buổi của mọi lớp, sĩ số = phân lớp − đổi ra + đổi vào + học bù vào (đổi buổi đã duyệt còn hiệu lực — cùng công thức nút "Theo buổi").

Nếu VPS **chưa** deploy PR #33 (Quản trị xem/xuất theo buổi, runbook `2026-10-22-quan-tri-ds-theo-buoi.md`) thì lần này deploy luôn cả hai — đều không migration; làm thêm phần kiểm tra mục 4 của runbook đó.

| Thay đổi | Ảnh hưởng dữ liệu |
|---|---|
| Thêm sheet "Sĩ số theo buổi" vào file xuất chia lớp | **Không migration**, chỉ đọc. Import phân lớp vẫn chỉ đọc sheet đầu ("Phân lớp") → nhập lại file không đổi hành vi |

Không đổi `.env`, không route mới, không prefix Nginx mới. Gián đoạn: backend 3–5 giây lúc `pm2 reload`. Dự kiến 5–10 phút.

Mọi lệnh chạy trên VPS bằng user thường (không sudo). Repo: `~/apps/boi-duong-nls`.

## 1. Ghi lại trạng thái + backup

```bash
cd ~/apps/boi-duong-nls
git log -1 --oneline | tee ~/truoc-deploy-si-so-buoi-$(date +%F).txt
git status --short
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
mkdir -p ~/backups/postgres
F=~/backups/postgres/truoc-si-so-buoi-$(date +%F-%H%M).dump
(umask 077; pg_dump "$DB_URL" -Fc -f "$F") && ls -lh "$F"
test -s "$F" || { echo "Dump rỗng — DỪNG"; exit 1; }
unset DB_URL
```

## 2. Kéo code + xác nhận KHÔNG có migration chờ

```bash
git pull origin main && git log --oneline -1
cd backend && npx prisma migrate status
```

Kỳ vọng `git log` là merge commit của PR "Sĩ số theo buổi" và `Database schema is up to date!`. Có migration chờ hoặc drift → **DỪNG**, báo lại.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-si-so-buoi-$(date +%F-%H%M).log
```

## 4. Kiểm tra sau deploy

```bash
pm2 logs boiduongnls-backend --lines 100 --nostream
```

- Không có lỗi lặp lại.
- Quản trị → Khóa bồi dưỡng → mở khóa → xuất **Danh sách chia lớp**. File có sheet **"Sĩ số theo buổi"** (sau "Tổng hợp theo mức học"); sheet đầu vẫn là "Phân lớp".
- Đối chiếu 1 lớp có đổi buổi: "Sĩ số buổi" trong sheet = sĩ số hiển thị ở nút **"Theo buổi"** của lớp đó.
- (Nếu cần) nhập lại thử chính file vừa xuất ở chế độ kiểm tra: không phát sinh lỗi do sheet mới.

## 5. Quay lui (nếu cần)

Không đổi schema/dữ liệu → chỉ quay lui code: trên máy dev `git revert -m 1 <merge-commit>` rồi push `main`; trên VPS `cd ~/apps/boi-duong-nls && git pull origin main && cd scripts/vps && bash 06-deploy.sh`. Không cần restore DB.
