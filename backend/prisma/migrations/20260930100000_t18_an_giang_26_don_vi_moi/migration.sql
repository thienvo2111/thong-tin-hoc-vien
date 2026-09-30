-- T18 (2026-09-30): bổ sung 26 đơn vị hành chính cấp xã/phường/đặc khu của
-- tỉnh An Giang còn THIẾU HOÀN TOÀN trong dia_danh (đối chiếu Quyết định
-- 2334/QĐ-BKHCN 2025 — danh mục mã đơn vị hành chính chính thức từ
-- 01/7/2025). Đã xác minh cả 26 mã và 26 tên đều chưa tồn tại trong phạm vi
-- tỉnh An Giang (parent_id tra theo cap/ten/ma bên dưới); 4 tên có trùng với
-- xã/phường ở TỈNH KHÁC (mã khác hoàn toàn) — hợp lệ, không vi phạm ràng
-- buộc uq_dia_danh_ma (unique chỉ đặt trên "ma", không đặt trên "ten").
--
-- CHỈ INSERT — không sửa/xoá dòng dia_danh nào khác. cap, trang_thai,
-- phien_ban dùng giá trị mặc định của cột tương ứng (phuong_xa_dac_khu chỉ
-- định tường minh vì cột "cap" không có default; trang_thai='active' và
-- phien_ban='hien_tai' để mặc định tự áp dụng).
--
-- parent_id tra bằng CROSS JOIN với subquery theo (cap='tinh_thanh',
-- ten='An Giang', ma='AG') thay vì hardcode UUID: dữ liệu dia_danh gốc (46
-- tỉnh/thành, các xã/phường) được nạp qua seed/import riêng ngoài migration,
-- không tồn tại trong shadow database dùng để validate migration. Dùng
-- CROSS JOIN (thay vì subquery trực tiếp trả NULL) để nếu không tìm thấy
-- tỉnh An Giang (shadow DB rỗng) thì KHÔNG insert dòng nào — tránh vi phạm
-- CHECK constraint chk_dia_danh_parent (phuong_xa_dac_khu bắt buộc parent_id
-- NOT NULL) — trong khi trên DB dev/prod thật (đã có An Giang) vẫn insert
-- đúng 26 dòng với parent_id chính xác.
INSERT INTO "dia_danh" ("id", "ma", "ten", "cap", "parent_id")
SELECT gen_random_uuid(), v.ma, v.ten, 'phuong_xa_dac_khu'::"cap_dia_danh", ag.id
FROM (VALUES
  ('30377', 'Phường Long Phú'),
  ('30766', 'Phường Tô Châu'),
  ('30367', 'Xã Vĩnh Hậu'),
  ('30421', 'Xã Phú Lâm'),
  ('30436', 'Xã Phú An'),
  ('30478', 'Xã Vĩnh Thạnh Trung'),
  ('30526', 'Xã An Cư'),
  ('30538', 'Xã Núi Cấm'),
  ('30568', 'Xã Vĩnh Gia'),
  ('30577', 'Xã Ô Lâm'),
  ('30607', 'Xã Bình Hòa'),
  ('30691', 'Xã Tây Phú'),
  ('30709', 'Xã Định Mỹ'),
  ('30781', 'Xã Tiên Hải'),
  ('30790', 'Xã Hòa Điền'),
  ('30793', 'Xã Vĩnh Điều'),
  ('30811', 'Xã Sơn Hải'),
  ('30814', 'Xã Hòn Nghệ'),
  ('30826', 'Xã Bình Giang'),
  ('30835', 'Xã Sơn Kiên'),
  ('30898', 'Xã Bình An'),
  ('30928', 'Xã Ngọc Chúc'),
  ('31024', 'Xã Đông Hòa'),
  ('31036', 'Xã Đông Hưng'),
  ('31069', 'Xã Vĩnh Thuận'),
  ('31105', 'Đặc khu Thổ Châu')
) AS v(ma, ten)
CROSS JOIN (
  SELECT id FROM "dia_danh" WHERE "cap" = 'tinh_thanh' AND "ten" = 'An Giang' AND "ma" = 'AG'
) AS ag;
