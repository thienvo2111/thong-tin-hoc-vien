-- Bổ sung lý do hủy cho đề nghị đổi buổi đã hủy TRƯỚC bản sửa "ghi rõ lý do hủy".
-- Chỉ chạm dòng da_huy do học viên (nguoi_xu_ly NULL) còn trống ghi_chu_xu_ly; suy ra từ nhật ký:
--   - bản bị thay khi học viên SỬA: nhật ký "Sửa đề nghị đổi buổi" có chi_tiet.de_nghi_cu_id = id
--   - học viên TỰ HỦY: nhật ký có chi_tiet.huy = true và de_nghi_id = id
-- Chạy SAU khi deploy code mới (chuỗi phải khớp GHI_CHU_HOC_VIEN_SUA / GHI_CHU_HOC_VIEN_HUY trong service).
-- Chạy lại nhiều lần vô hại (chỉ điền chỗ còn NULL).

BEGIN;

UPDATE doi_buoi_hoc d
SET ghi_chu_xu_ly = 'Học viên đã sửa (thay bằng đề nghị mới)',
    xu_ly_luc = COALESCE(d.xu_ly_luc, nk.thoi_gian)
FROM nhat_ky_hoat_dong nk
WHERE nk.hanh_dong = 'de_nghi_doi_buoi'
  AND nk.chi_tiet->>'de_nghi_cu_id' = d.id::text
  AND d.trang_thai = 'da_huy' AND d.nguoi_xu_ly IS NULL AND d.ghi_chu_xu_ly IS NULL;

UPDATE doi_buoi_hoc d
SET ghi_chu_xu_ly = 'Học viên tự hủy',
    xu_ly_luc = COALESCE(d.xu_ly_luc, nk.thoi_gian)
FROM nhat_ky_hoat_dong nk
WHERE nk.hanh_dong = 'de_nghi_doi_buoi'
  AND nk.chi_tiet->>'de_nghi_id' = d.id::text
  AND (nk.chi_tiet->>'huy')::boolean IS TRUE
  AND d.trang_thai = 'da_huy' AND d.nguoi_xu_ly IS NULL AND d.ghi_chu_xu_ly IS NULL;

-- Kiểm tra: dòng da_huy do học viên còn trống ghi chú phải = 0.
SELECT ghi_chu_xu_ly, count(*) FROM doi_buoi_hoc
WHERE trang_thai = 'da_huy' AND nguoi_xu_ly IS NULL GROUP BY 1 ORDER BY 1;

COMMIT;
