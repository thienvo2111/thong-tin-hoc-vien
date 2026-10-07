# Runbook deploy — ADR 0004 + Dashboard thống kê

Áp dụng cho lần deploy đầu tiên sau 2026-10-06, khi `main` đã gồm:
- ADR 0004 (L1–L9: điểm học, giảng viên, hỗ trợ giảng viên, bảng kiểm, báo vắng/đổi lớp, nhắc lịch, vận hành);
- Dashboard thống kê (`/thong-ke/*`, trang `/admin/tong-quan` mới, `/ho-tro/thong-ke`);
- Sửa cách chép frontend (giữ asset cũ, `index.html` no-cache, tự tải lại khi lỗi chunk).

Học viên đang dùng hệ thống → làm **ngoài giờ cao điểm (sau 22h)**. Thời gian dự kiến: 20–30 phút.
Gián đoạn dự kiến: backend 3–5 giây khi `pm2 reload`; frontend không gián đoạn (asset cũ được giữ).

Mọi lệnh chạy trên VPS bằng user thường (không sudo) trừ khi ghi `sudo`. Repo: `~/apps/boi-duong-nls`.

---

## 0. Trước ngày deploy

- [ ] Báo cho tài khoản Sở/Phòng/Trường: trang **Tổng quan** đổi sang dashboard biểu đồ; số liệu tổng quan
      của đơn vị có thể khác trước (nay áp đúng quy tắc khóa R1/R2, lọc đơn vị tính cả đơn vị con);
      nút **Xuất Excel tổng quan** chuyển sang trang **Báo cáo**.
- [ ] Kiểm tra đồng hồ VPS (đã từng lệch ~1h do chưa bật NTP): `timedatectl` → `System clock synchronized: yes`.

## 1. Ghi lại trạng thái hiện tại (để quay lui)

```bash
cd ~/apps/boi-duong-nls
git rev-parse --short HEAD | tee ~/truoc-deploy-$(date +%F).txt   # commit đang chạy
pm2 status
```

## 2. Sao lưu DB thủ công (BẮT BUỘC — backup tự động chưa được cài)

```bash
mkdir -p ~/backups/postgres
pg_dump -h 127.0.0.1 -U hocvien_app -Fc thong_tin_hoc_vien \
  -f ~/backups/postgres/truoc-adr0004-$(date +%F-%H%M).dump
ls -lh ~/backups/postgres/ | tail -3      # kiểm tra file có dung lượng hợp lý (không phải 0 byte)
```

## 3. Kéo code mới TRƯỚC khi chạy script

`06-deploy.sh` được sửa trong lần này. Bash đọc script đang chạy từ file cũ, nên phải `git pull`
riêng trước để lần chạy này dùng đúng bản mới (giữ asset cũ).

```bash
cd ~/apps/boi-duong-nls
git pull origin main
git log --oneline -1
```

## 4. Kiểm tra migration đang chờ

```bash
cd ~/apps/boi-duong-nls/backend
npx prisma migrate status
```

Kỳ vọng: **11 migration chưa áp**, đúng danh sách sau (không hơn, không kém):

```
20261007100000_diem_hoc
20261007110000_giang_vien_enum
20261007110100_giang_vien
20261007120000_ho_tro_giang_vien_enum
20261007120100_ho_tro_giang_vien
20261007130000_hau_can_thuc_dia
20261007140000_bang_kiem
20261007150000_bao_vang_de_nghi_doi_lop
20261007160000_giang_vien_vai_tro
20261007160100_tai_khoan_giang_vien
20261007170000_nhat_ky_nhac_lich
```

Nếu thấy migration lạ hoặc báo drift → **DỪNG**, không chạy tiếp.

Tất cả là migration bổ sung (bảng mới, cột mới cho phép NULL/có mặc định, thêm giá trị enum,
nới ràng buộc `chk_nguoi_dung_scope` để nhận vai trò mới). Khóa ghi bảng `nguoi_dung` chỉ vài mili giây.

## 5. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

Script sẽ: `npm ci` → `prisma generate` → build → cảnh báo prefix Nginx thiếu → `migrate deploy`
→ `pm2 reload` → build frontend → chép asset (giữ bản cũ) → thay `index.html`.
Cảnh báo "Nginx CHUA proxy cac prefix" ở bước này là **bình thường** — xử lý ở bước 6.

## 6. Cập nhật Nginx (prefix mới + `index.html` no-cache)

```bash
sudo bash ~/apps/boi-duong-nls/scripts/vps/05-install-nginx.sh
sudo nginx -t && sudo systemctl reload nginx
```

Prefix mới cần có: `diem-hoc giang-vien ho-tro-giang-vien bang-kiem cong-giang-vien van-hanh thong-ke`.

## 7. Kiểm tra sau deploy (smoke test)

Từ VPS hoặc máy ngoài:

```bash
D=https://boiduongnls.hcmue.edu.vn
for p in thong-ke/bo-loc van-hanh diem-hoc giang-vien ho-tro-giang-vien/de-nghi-doi-lop bang-kiem/quy-tac cong-giang-vien/lich-day; do
  printf "%-28s " "$p"; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "$D/$p"
done
curl -sI "$D/" | grep -i cache-control      # kỳ vọng: no-cache
```

Kỳ vọng mỗi API: `401 application/json`. Nếu thấy `200 text/html` → Nginx chưa proxy prefix đó (làm lại bước 6).

Trên trình duyệt:
- [ ] Học viên: đăng nhập → trang chính → mở hồ sơ → bấm vào phiếu khảo sát (SSO) mở được.
- [ ] Quản trị: `/admin/tong-quan` hiện 9 khối, số "Tham gia" khớp số học viên đã import.
- [ ] Một tài khoản trường: dashboard chỉ có số của trường mình; khối xếp hạng chỉ hiện "Thứ x/y".
- [ ] `/admin/bao-cao` → thẻ **Xuất Excel tổng quan** tải được file.
- [ ] `pm2 logs boiduongnls-backend --lines 100` không có lỗi lặp lại.

## 8. Quay lui (nếu cần)

Code cũ chạy được trên schema mới (migration chỉ bổ sung) → **không cần khôi phục DB** khi quay lui code.

```bash
# Trên máy dev: revert merge commit trên main rồi push
git revert -m 1 <merge-commit> && git push
# Trên VPS:
cd ~/apps/boi-duong-nls && git pull origin main
cd scripts/vps && bash 06-deploy.sh
```

Chỉ khôi phục DB từ bản dump ở bước 2 khi **dữ liệu bị sai** (không phải khi chỉ lỗi giao diện):

```bash
pm2 stop boiduongnls-backend
pg_restore -h 127.0.0.1 -U hocvien_app -d thong_tin_hoc_vien --clean --if-exists \
  ~/backups/postgres/truoc-adr0004-<ngay-gio>.dump
# rồi checkout commit ghi ở bước 1, build lại, pm2 start
```

## 9. Sau deploy

- [ ] Ghi commit đã deploy vào ghi chú dự án.
- [ ] Cài backup tự động (`bash 07-setup-backup.sh`) — lần sau `06-deploy.sh` sẽ tự backup trước migrate.
