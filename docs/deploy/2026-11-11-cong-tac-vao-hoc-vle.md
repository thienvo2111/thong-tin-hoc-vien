# Runbook deploy — Công tắc "Mở vào học VLE" theo khóa (CÓ migration)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Đợt này đưa lên nhánh `feat/vle-cong-tac-khoa` — **phải merge vào `main` trước** (`06-deploy.sh` chỉ kéo `main`). Chạy **sau** runbook `2026-11-11-vao-hoc-vle.md` (hoặc cùng đợt).

| Thay đổi | Ảnh hưởng dữ liệu |
|---|---|
| Cột mới `khoa_boi_duong.mo_vao_hoc_vle` (mặc định `false`) + công tắc **"Mở vào học VLE"** ở Quản trị → khóa | **1 migration, chỉ thêm**: `20261111090000_mo_vao_hoc_vle` (`ADD COLUMN ... NOT NULL DEFAULT false`). Không sửa dữ liệu cũ |
| `GET /sso/vle/trang-thai` thêm `mo`; `POST /sso/vle/form` khóa chưa mở → `409 VLE_CHUA_MO` (mục 10.2 `docs/api-contract.md`) | Không ghi nhật ký khi bị chặn. Bật/tắt công tắc ghi lịch sử cấu hình khóa ("Mở vào học VLE") |

**Sau deploy MỌI khóa đều TẮT** → nút "Vào học VLE" ẩn với mọi học viên, kể cả khi đã điền `VLE_LOGIN_KEY`. `VLE_LOGIN_KEY` vẫn là công tắc tổng (trống → tắt cả hệ thống như cũ). Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

Mọi lệnh chạy trên VPS bằng user thường (không sudo). Repo: `~/apps/boi-duong-nls`.

## 1. Backup + kéo code + xác nhận migration chờ

Backup DB như mục 1 của `2026-11-11-vao-hoc-vle.md`, rồi:

```bash
cd ~/apps/boi-duong-nls
git pull origin main && git log --oneline -3
cd backend && npx prisma migrate status
```

Kỳ vọng: migration chờ chỉ gồm `20261111090000_mo_vao_hoc_vle` (cùng 2 migration `dang_nhap_vle` nếu chưa deploy đợt trước). Có migration lạ hoặc báo drift → **DỪNG**, báo lại.

## 2. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-cong-tac-vle-$(date +%F-%H%M).log
cd ~/apps/boi-duong-nls/backend && npx prisma migrate status   # "Database schema is up to date!"
psql "$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')" -Atc \
  "SELECT ma_khoa, mo_vao_hoc_vle FROM khoa_boi_duong;"        # tất cả f
```

Kiểm tra: học viên có lớp VLE → **không** thấy nút "Vào học VLE".

## 3. Bật khi VLE bắt đầu học

Quản trị → **Khóa bồi dưỡng** → khóa **AG-2026** → bật **"Mở vào học VLE"** (có hiệu lực ngay, không cần reload). Học viên đã xếp lớp VLE thấy nút (với điều kiện `VLE_LOGIN_KEY` đã điền). Tắt lại cùng chỗ → nút ẩn ngay.

## 4. Quay lui

- **Tắt nhanh**: gạt tắt "Mở vào học VLE" của khóa (hoặc xóa `VLE_LOGIN_KEY` như runbook trước).
- **Gỡ code**: `git revert` commit merge của nhánh này → push `main` → VPS `git pull origin main && cd scripts/vps && bash 06-deploy.sh`. Cột `mo_vao_hoc_vle` để nguyên (vô hại). **Không** restore DB.
