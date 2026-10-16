-- 2026-10-16, ADR 0007 D11 (đổi lại đề nghị đã duyệt): chỉ đổi index, KHÔNG đổi dữ liệu.
-- Tách uq_doi_buoi_hoat_dong thành 2 partial unique để 1 cặp (đăng ký, buổi nguồn)
-- có thể đồng thời có 1 đề nghị đã duyệt + 1 đề nghị đổi lại đang chờ.
-- Dữ liệu hiện có thỏa cả 2 index (trước đây tối đa 1 dòng chờ|đã duyệt / cặp).
-- Rollback (chỉ khi không còn cặp nào có cả chờ + đã duyệt):
--   DROP INDEX "uq_doi_buoi_cho"; DROP INDEX "uq_doi_buoi_da_duyet";
--   CREATE UNIQUE INDEX "uq_doi_buoi_hoat_dong" ON "doi_buoi_hoc"("dang_ky_hoc_id", "lich_nguon_id")
--       WHERE "trang_thai" IN ('cho_duyet', 'da_duyet');

DROP INDEX "uq_doi_buoi_hoat_dong";
CREATE UNIQUE INDEX "uq_doi_buoi_cho" ON "doi_buoi_hoc"("dang_ky_hoc_id", "lich_nguon_id")
    WHERE "trang_thai" = 'cho_duyet';
CREATE UNIQUE INDEX "uq_doi_buoi_da_duyet" ON "doi_buoi_hoc"("dang_ky_hoc_id", "lich_nguon_id")
    WHERE "trang_thai" = 'da_duyet';
