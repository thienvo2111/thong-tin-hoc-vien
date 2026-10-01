-- T17 (2026-10-01): tách cột "noi_sinh" (1 ô text tự do, thêm 2026-09-30) ra
-- 3 cột noi_sinh_tinh/noi_sinh_huyen/noi_sinh_xa (vẫn text tự do, không FK)
-- theo yêu cầu thực tế.
--
-- File này viết tay từ `prisma migrate diff --from-url ... --to-schema-
-- datamodel prisma/schema.prisma --script` (môi trường không tương tác nên
-- không dùng được `migrate dev --create-only` trực tiếp — cùng cách "migrate
-- diff thủ công" đã dùng ở các migration trước). Đã bỏ 4 câu "DROP INDEX" cho
-- GIN trgm index (tạo bằng raw SQL, ngoài schema.prisma DSL) — cùng gotcha đã
-- biết ở migration 20260928065926_t14_loai_dot_xac_nhan_enum,
-- 20260929041100_t6_lop_hoc_lich_hoc_columns.
--
-- Đã kiểm tra dữ liệu hiện có trước khi xoá cột "noi_sinh": 21/7654 hồ sơ có
-- giá trị, toàn bộ là dữ liệu test (ví dụ "Xã test 9057c9f8, Tỉnh test
-- 9057c9f8", "Xã KBD 8fff9d76, Tỉnh KBD 8fff9d76" — sinh bởi các test
-- e2e/unit ngày 2026-09-30) — không phải dữ liệu nghiệp vụ thật, nên XOÁ LUÔN
-- cột cũ (không giữ deprecated).

-- AlterTable
ALTER TABLE "hoc_vien" DROP COLUMN "noi_sinh",
ADD COLUMN     "noi_sinh_huyen" VARCHAR(255),
ADD COLUMN     "noi_sinh_tinh" VARCHAR(255),
ADD COLUMN     "noi_sinh_xa" VARCHAR(255);
