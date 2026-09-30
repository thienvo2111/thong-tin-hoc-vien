-- T12 (mo-rong-nls-an-giang.md, 2026-09-30): migration A — 2 enum MỚI hoàn
-- toàn (trang_thai_diem_danh, nguon_diem_danh) dùng cho bảng diem_danh
-- (migration B) + 2 giá trị mới cho enum loai_danh_muc_import đã có sẵn
-- (diem_danh, ket_qua_giai_doan) — ALTER TYPE ... ADD VALUE phải nằm trong
-- migration RIÊNG, chạy trước migration nào dùng giá trị mới (Postgres
-- không cho dùng giá trị enum vừa ADD VALUE trong cùng transaction đã thêm
-- nó) — cùng pattern đã dùng ở T14/T15/T5/T6.

-- CreateEnum
CREATE TYPE "trang_thai_diem_danh" AS ENUM ('co_mat', 'vang', 'vang_co_phep');

-- CreateEnum
CREATE TYPE "nguon_diem_danh" AS ENUM ('zoom', 'ky_ten', 'qr', 'thu_cong');

-- AlterEnum
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'diem_danh';
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'ket_qua_giai_doan';
