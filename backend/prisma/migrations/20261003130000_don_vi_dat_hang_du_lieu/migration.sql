-- Khóa chỉ có đúng 1 đơn vị theo dõi -> dùng đơn vị đó làm don_vi_dat_hang_id
-- (khóa có 0 hoặc >=2 đơn vị theo dõi giữ nguyên, đã được duyệt thủ công qua
-- scripts/kiem_tra_don_vi_dat_hang.sql trước khi chạy migration này).
-- MIN(don_vi_id) không dùng trực tiếp được vì Postgres không có aggregate
-- MIN/MAX cho kiểu uuid — ép qua text rồi ép lại uuid; vì HAVING COUNT(*) = 1
-- nên MIN chỉ đơn giản trả về giá trị duy nhất của nhóm, không ảnh hưởng kết quả.
UPDATE khoa_boi_duong k
SET don_vi_dat_hang_id = t.don_vi_id
FROM (
    SELECT khoa_id, MIN(don_vi_id::text)::uuid AS don_vi_id
    FROM khoa_don_vi_theo_doi
    GROUP BY khoa_id
    HAVING COUNT(*) = 1
) t
WHERE t.khoa_id = k.id;

-- Cơ chế "đơn vị theo dõi" (T2) không còn cần thiết — phạm vi xem khóa giờ
-- suy ra trực tiếp từ don_vi_dat_hang_id (R1) + hoc_vien.don_vi_cong_tac_id (R2).
DROP TABLE "khoa_don_vi_theo_doi";

-- Bỏ luồng duyệt khóa — mọi khóa nhap/cho_duyet/tu_choi coi như đã duyệt.
UPDATE khoa_boi_duong
SET trang_thai = 'da_duyet'
WHERE trang_thai IN ('nhap', 'cho_duyet', 'tu_choi');
