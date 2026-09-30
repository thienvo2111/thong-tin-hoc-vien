-- T16 (2026-09-30): sửa hồ sơ học viên (M4) theo quyết định nghiệp vụ mới:
-- "Nơi sinh" đổi từ Select ràng buộc dia_danh (địa giới HIỆN TẠI) sang 1 ô
-- nhập TỰ DO (giấy khai sinh có thể ghi theo địa giới CŨ, DB không có bộ dữ
-- liệu địa giới cũ để chọn). Thêm mới "Cư trú" (tùy chọn) dùng đúng địa giới
-- HIỆN TẠI (2 cấp tỉnh/thành -> phường/xã, giống cách làm CŨ của nơi sinh).
--
-- CHỈ ADD COLUMN — KHÔNG xoá noi_sinh_id/phuong_xa_id (deprecated, giữ
-- nguyên để không phá dữ liệu cũ, không ảnh hưởng session khác đang dùng
-- chung DB này).

-- AlterTable: thêm cột mới
ALTER TABLE "hoc_vien" ADD COLUMN "noi_sinh" VARCHAR(500);
ALTER TABLE "hoc_vien" ADD COLUMN "cu_tru_tinh_id" UUID;
ALTER TABLE "hoc_vien" ADD COLUMN "cu_tru_phuong_xa_id" UUID;

-- AddForeignKey
ALTER TABLE "hoc_vien" ADD CONSTRAINT "hoc_vien_cu_tru_tinh_id_fkey" FOREIGN KEY ("cu_tru_tinh_id") REFERENCES "dia_danh"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "hoc_vien" ADD CONSTRAINT "hoc_vien_cu_tru_phuong_xa_id_fkey" FOREIGN KEY ("cu_tru_phuong_xa_id") REFERENCES "dia_danh"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Migrate dữ liệu 1 lần: hoc_vien.noi_sinh_id/phuong_xa_id (cũ, FK) -> chuỗi
-- text cho cột noi_sinh mới. Dạng "{tên phường/xã}, {tên tỉnh/thành}" nếu có
-- cả 2, hoặc chỉ tên tỉnh/thành nếu chỉ có noi_sinh_id. Chỉ áp dụng cho hồ sơ
-- CHƯA có noi_sinh (cột mới toanh, luôn NULL trước dòng UPDATE này — điều
-- kiện IS NULL chỉ để an toàn nếu script bị chạy lại).
UPDATE "hoc_vien" hv
SET "noi_sinh" = CASE
  WHEN hv."phuong_xa_id" IS NOT NULL THEN
    (SELECT pxa."ten" FROM "dia_danh" pxa WHERE pxa."id" = hv."phuong_xa_id") || ', ' || tinh."ten"
  ELSE tinh."ten"
END
FROM "dia_danh" tinh
WHERE tinh."id" = hv."noi_sinh_id"
  AND hv."noi_sinh_id" IS NOT NULL
  AND hv."noi_sinh" IS NULL;
