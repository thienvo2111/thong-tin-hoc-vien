-- ADR 0014 C1 (issue #34): nấc chuyên cần thứ 3 — công nhận buổi lớp Zoom cũ
-- chỉ khi cùng mức. Chỉ THÊM giá trị enum, không đổi dữ liệu. Tách file với
-- đổi DEFAULT vì PostgreSQL không cho dùng giá trị enum mới trong cùng
-- transaction vừa thêm.
ALTER TYPE "che_do_chuyen_can" ADD VALUE 'cong_nhan_cung_muc';
