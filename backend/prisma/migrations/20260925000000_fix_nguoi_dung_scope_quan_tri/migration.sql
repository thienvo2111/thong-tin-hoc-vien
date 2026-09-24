-- Sửa chk_nguoi_dung_scope: don_vi_id được phép NULL cho vai_tro='quan_tri'
-- (phạm vi quan_tri là toàn hệ thống, không nên bắt gắn giả vào 1 đơn vị
-- nào — xem docs/database-ddl.sql, cập nhật commit e737e78). Thay thế
-- constraint cũ (bắt buộc don_vi_id NOT NULL cho MỌI vai_tro <> 'hoc_vien',
-- kể cả quan_tri) bằng bản mới có nhánh riêng cho quan_tri.

ALTER TABLE "nguoi_dung" DROP CONSTRAINT "chk_nguoi_dung_scope";

ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_scope" CHECK (
    (vai_tro = 'hoc_vien' AND don_vi_id IS NULL AND hoc_vien_id IS NOT NULL)
    OR
    (vai_tro = 'quan_tri' AND hoc_vien_id IS NULL)
    OR
    (vai_tro NOT IN ('hoc_vien', 'quan_tri') AND don_vi_id IS NOT NULL AND hoc_vien_id IS NULL)
);
