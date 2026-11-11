# Runbook deploy — Nhật ký ADR 0014 + bảng điểm danh hiện buổi lớp cũ (không migration)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Prod hiện = `20df5d6`. Đợt này đưa lên 2 nhánh đã merge vào `main`:

| Thay đổi | Ảnh hưởng dữ liệu |
|---|---|
| Nhật ký "Phân lớp" khi **nhập file** chuyển/gỡ lớp ghi thêm số buổi đã điểm danh ở lớp cũ, kết luận được/không được công nhận theo nấc của khóa lúc chuyển, số đề nghị đổi buổi/học bù bị hủy | Chỉ **thêm** dòng `nhat_ky_hoat_dong` |
| Đề nghị tự hủy khi chuyển lớp ghi `hanh_dong = huy_doi_buoi_chuyen_lop` ("Hủy đổi buổi/học bù do chuyển lớp") thay cho `duyet_doi_buoi` | Chỉ thêm nhật ký. Dòng cũ đã ghi từ lúc deploy #35 vẫn là `duyet_doi_buoi` (`chi_tiet.tu_dong_chuyen_lop = true`) — không sửa |
| **Lịch sử cấu hình khóa**: mỗi lần sửa khóa có đổi ghi `cap_nhat_cau_hinh_khoa` (trường, cũ → mới); tab **"Lịch sử cấu hình"** ở trang chi tiết khóa (`GET /khoa-boi-duong/{id}/lich-su-cau-hinh`, chỉ Quản trị) | Chỉ thêm nhật ký. Các lần sửa **trước** deploy không có lịch sử |
| Script `backend/scripts/thong-ke-diem-danh-buoi-1-lop-moi.ts` (ts-node, chạy tay): xuất Excel học viên **đã điểm danh buổi 1 ở lớp cũ** nhưng hiện thuộc lớp có buổi 1 **chưa diễn ra** (cùng giai đoạn) — sheet "Thống kê" + "Danh sách" | **Chỉ đọc** (1 câu `SELECT`). File có PII (ngày sinh, SĐT, email) |
| **Bảng điểm danh lớp** (`GET /lop/{id}/diem-danh`) và **trang lớp** (hỗ trợ GV, cổng giảng viên) hiện buổi được công nhận từ lớp khác (lớp cũ trước khi chuyển / học bù) theo nấc `che_do_chuyen_can` của khóa: "Có mặt – ở lớp X", **chỉ đọc** | **Chỉ đọc**. Không ghi đè dòng điểm danh lớp cũ |

Không migration, không đổi `.env`, không route prefix mới (`/khoa-boi-duong`, `/lop` đã có trong Nginx). Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

**Lưu ý nấc chuyên cần:** bảng điểm danh chỉ hiện buổi lớp cũ của lớp Zoom khi khóa ở nấc `cong_nhan_lop_cu` (bất kể mức) hoặc `cong_nhan_cung_muc` mà hai lớp cùng mức. Khóa **AG-2026** đang `theo_lop_hien_tai` → nếu muốn hiện, Quản trị vào khóa → **Cấu hình điểm danh Zoom** → chọn **"Công nhận buổi đã có mặt ở lớp cũ (bất kể mức)"**. Lần đổi này sẽ là dòng đầu tiên trong tab "Lịch sử cấu hình".

Mọi lệnh chạy trên VPS bằng user thường (không sudo). Repo: `~/apps/boi-duong-nls`.

## 1. Ghi lại trạng thái + backup

```bash
cd ~/apps/boi-duong-nls
git log -1 --oneline | tee ~/truoc-deploy-nhat-ky-adr14-$(date +%F).txt
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
mkdir -p ~/backups/postgres
F=~/backups/postgres/truoc-nhat-ky-adr14-$(date +%F-%H%M).dump
(umask 077; pg_dump "$DB_URL" -Fc -f "$F") && ls -lh "$F"
test -s "$F" || { echo "Dump rỗng — DỪNG"; exit 1; }
unset DB_URL
```

`git log -1` phải là `20df5d6`. Khác → **DỪNG**, báo lại.

## 2. Kéo code + xác nhận không có migration chờ

```bash
git pull origin main && git log --oneline -3
cd backend && npx prisma migrate status
```

Kỳ vọng: `Database schema is up to date!`. Có migration chờ hoặc drift → **DỪNG**, báo lại.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-nhat-ky-adr14-$(date +%F-%H%M).log
```

## 4. Kiểm tra sau deploy

```bash
pm2 logs boiduongnls-backend --lines 100 --nostream
```

- Trang chi tiết khóa (Quản trị) có tab **"Lịch sử cấu hình"** (trống tới lần sửa đầu tiên). Sửa thử 1 cấu hình rồi đổi lại → có 2 dòng, đúng người/giờ, giá trị cũ → mới.
- Bảng điểm danh của 1 lớp có học viên đã chuyển lớp (khóa ở nấc `cong_nhan_lop_cu`): buổi đã có mặt ở lớp cũ hiện "Có mặt – ở lớp …", ô mờ, không bấm sửa được.
- Hồ sơ học viên → Nhật ký: lần import chuyển lớp tiếp theo có dòng "Phân lớp … (nhập file) — đã điểm danh k buổi ở lớp …".

## 5. Xuất thống kê điểm danh buổi 1 ở lớp cũ (sau khi deploy xong)

Tham số 1: mã khóa (vd `AG-2026`) hoặc `-` = mọi khóa. Tham số 2: đường dẫn file Excel. Console chỉ in số học viên theo cặp lớp, không in PII.

```bash
cd ~/apps/boi-duong-nls/backend
(umask 077; npx ts-node scripts/thong-ke-diem-danh-buoi-1-lop-moi.ts AG-2026 ~/diem-danh-buoi-1-lop-moi-$(date +%F).xlsx)
ls -l ~/diem-danh-buoi-1-lop-moi-*.xlsx
```

File có PII — tải về qua `scp` rồi **xóa trên VPS** sau khi dùng; không gửi qua nhóm Zalo công khai. Script chạy lại được bất cứ lúc nào (danh sách thay đổi theo giờ chạy vì so với buổi 1 "chưa diễn ra").

## 6. Quay lui (nếu cần)

Không có thay đổi schema/dữ liệu cần trả lại (dòng nhật ký mới để nguyên). Trên máy dev: `git revert -m 1 <merge-commit>` cho từng merge của đợt này rồi push `main`; VPS `git pull origin main && cd scripts/vps && bash 06-deploy.sh`. Không cần restore DB.
