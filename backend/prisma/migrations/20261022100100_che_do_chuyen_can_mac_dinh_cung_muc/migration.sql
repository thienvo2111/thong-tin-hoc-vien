-- ADR 0014 C3 (issue #34): khóa TẠO MỚI mặc định cong_nhan_cung_muc. Chỉ đổi
-- DEFAULT — khóa đang có giữ nguyên giá trị (không UPDATE).
ALTER TABLE "khoa_boi_duong" ALTER COLUMN "che_do_chuyen_can" SET DEFAULT 'cong_nhan_cung_muc';
