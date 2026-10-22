# Runbook deploy — Nấc chuyên cần "công nhận lớp cũ cùng mức" (ADR 0014, issue #34)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Công tắc chuyên cần theo khóa (`che_do_chuyen_can`) có thêm nấc thứ 3 **`cong_nhan_cung_muc`**: buổi đã điểm danh ở lớp Zoom khác lớp hiện tại (cùng giai đoạn, cùng buổi số) chỉ được tính khi hai lớp **cùng mức** (`muc_nang_luc`; cả hai không có mức = cùng mức). Áp cho dashboard chuyên cần, DS lớp/DS buổi của người hỗ trợ, tình hình đi học. Khóa **tạo mới** mặc định nấc này.

| Thay đổi | Ảnh hưởng dữ liệu |
|---|---|
| Migration `20261022100000_che_do_chuyen_can_cung_muc` | **Chỉ thêm** giá trị enum `cong_nhan_cung_muc`. Không đổi dòng nào |
| Migration `20261022100100_che_do_chuyen_can_mac_dinh_cung_muc` | **Chỉ đổi DEFAULT** cột `khoa_boi_duong.che_do_chuyen_can`. Khóa đang có **giữ nguyên** giá trị |
| Màn Cấu hình điểm danh Zoom có 3 lựa chọn | Đổi nấc chỉ đổi cách tính, **không xóa điểm danh** |

Không đổi `.env`, không route mới, không prefix Nginx mới. Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

### Cùng đợt: import phân lớp chuyển/gỡ lớp (ADR 0014, issue #35, #36 — không migration)

| Thay đổi | Ảnh hưởng dữ liệu |
|---|---|
| Bước **kiểm tra** import phân lớp: cảnh báo (không chặn) khi chuyển/gỡ lớp học viên đã có điểm danh ở lớp cũ (số buổi + có được công nhận theo nấc của khóa không), và số đề nghị đổi buổi/học bù sẽ bị hủy | Chỉ đọc |
| Bước **xác nhận** import khi **chuyển** lớp: tự hủy **hết** đề nghị đổi buổi/học bù (`cho_duyet` + `da_duyet`, kể cả bản đã học buổi chốt) có buổi nguồn thuộc lớp cũ, đúng giai đoạn — `da_huy`, ghi chú "Hủy tự động do chuyển lớp (nhập file)", có nhật ký, **không gửi email**. Gỡ lớp (`-`) không hủy | **Có ghi dữ liệu** khi Quản trị xác nhận import chuyển lớp. Hủy là một chiều (không có nút khôi phục) — luôn đọc cảnh báo ở bước kiểm tra trước khi xác nhận |

### Các thay đổi khác trên `main` cũng lên prod trong đợt này (prod hiện = `dcd9d49`)

Tất cả **không migration**: Excel nhu cầu theo đợt thêm số buổi đã học (`f44208b`), hướng dẫn nhu cầu mức (`17ea6a1`), Quản trị xem/xuất DS theo buổi (PR #33), sheet Sĩ số theo buổi trong Excel chia lớp (PR #37). Nếu `git log -1` trên VPS **không phải** `dcd9d49` thì báo lại trước khi chạy.

**Việc tay sau deploy (bắt buộc):** khóa **An Giang** hiện tại cần công nhận cả lớp cũ khác mức → Quản trị vào khóa → **Cấu hình điểm danh Zoom** → chọn **"Công nhận buổi đã có mặt ở lớp cũ (bất kể mức)"** (`cong_nhan_lop_cu`) nếu khóa chưa ở nấc đó.

Mọi lệnh chạy trên VPS bằng user thường (không sudo). Repo: `~/apps/boi-duong-nls`.

## 1. Ghi lại trạng thái + backup

```bash
cd ~/apps/boi-duong-nls
git log -1 --oneline | tee ~/truoc-deploy-cung-muc-$(date +%F).txt
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c "SELECT ma_khoa, che_do_chuyen_can FROM khoa_boi_duong ORDER BY ma_khoa" | tee -a ~/truoc-deploy-cung-muc-$(date +%F).txt
mkdir -p ~/backups/postgres
F=~/backups/postgres/truoc-cung-muc-$(date +%F-%H%M).dump
(umask 077; pg_dump "$DB_URL" -Fc -f "$F") && ls -lh "$F"
test -s "$F" || { echo "Dump rỗng — DỪNG"; exit 1; }
unset DB_URL
```

## 2. Kéo code + xác nhận đúng 2 migration chờ

```bash
git pull origin main && git log --oneline -1
cd backend && npx prisma migrate status
```

Kỳ vọng chỉ 2 migration chờ ở trên (cộng migration của các PR khác deploy chung, nếu có). Drift → **DỪNG**, báo lại.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-cung-muc-$(date +%F-%H%M).log
```

## 4. Kiểm tra sau deploy

```bash
cd ~/apps/boi-duong-nls
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c "SELECT ma_khoa, che_do_chuyen_can FROM khoa_boi_duong ORDER BY ma_khoa"
psql "$DB_URL" -c "SELECT column_default FROM information_schema.columns WHERE table_name='khoa_boi_duong' AND column_name='che_do_chuyen_can'"
unset DB_URL
pm2 logs boiduongnls-backend --lines 100 --nostream
```

- Giá trị từng khóa **giống hệt** bước 1; DEFAULT = `'cong_nhan_cung_muc'::che_do_chuyen_can`.
- Màn Cấu hình điểm danh Zoom có 3 lựa chọn; làm việc tay cho khóa An Giang (ở trên).
- Import phân lớp: tải file đã chuyển lớp vài học viên → bước kiểm tra hiện cảnh báo điểm danh lớp cũ / đề nghị sẽ hủy (chưa cần bấm xác nhận để kiểm tra).

## 5. Quay lui (nếu cần)

Code cũ **không đọc được** giá trị enum mới → trước khi revert code, đưa mọi khóa đang ở nấc mới về nấc cũ và trả DEFAULT:

```sql
UPDATE khoa_boi_duong SET che_do_chuyen_can = 'theo_lop_hien_tai' WHERE che_do_chuyen_can = 'cong_nhan_cung_muc';
ALTER TABLE khoa_boi_duong ALTER COLUMN che_do_chuyen_can SET DEFAULT 'theo_lop_hien_tai';
```

Giá trị enum để nguyên (PostgreSQL không bỏ được giá trị enum; không ảnh hưởng). Đề nghị đổi buổi/học bù đã bị hủy do chuyển lớp (#35) **không** tự khôi phục khi quay lui — tra bằng `ghi_chu_xu_ly = 'Hủy tự động do chuyển lớp (nhập file)'` nếu cần xử lý tay. Sau đó trên máy dev `git revert -m 1 <merge-commit>` rồi push `main`; VPS `git pull origin main && cd scripts/vps && bash 06-deploy.sh`. Không cần restore DB.
