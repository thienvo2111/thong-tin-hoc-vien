-- Chạy TRƯỚC `prisma migrate deploy` (schema cũ: don_vi_to_chuc_id).
--
-- Script CHỈ ĐỌC — chạy TRƯỚC 2 migration
-- 20261003120000_don_vi_dat_hang_rename / 20261003130000_don_vi_dat_hang_du_lieu
-- để người dùng duyệt danh sách thay đổi (spec §7 "Trước khi deploy VPS").
-- Tại thời điểm chạy, cột VẪN còn tên don_vi_to_chuc_id và bảng
-- khoa_don_vi_theo_doi VẪN còn tồn tại (chưa migrate) — script dùng đúng tên
-- cũ đó, KHÔNG dùng don_vi_dat_hang_id/don_vi_dat_hang (final-review.md fix #1).
-- Không ghi dữ liệu.
-- Dùng: psql -d thong_tin_hoc_vien -f scripts/kiem_tra_don_vi_dat_hang.sql

-- (a) Khóa có đúng 1 đơn vị theo dõi -> migration bước 2 sẽ tự đổi
-- don_vi_dat_hang_id của khóa sang đơn vị theo dõi đó.
SELECT
    k.ma_khoa,
    dv_hien_tai.ten_don_vi AS don_vi_dat_hang_hien_tai,
    dv_moi.ten_don_vi      AS don_vi_se_doi_sang
FROM khoa_boi_duong k
JOIN don_vi_cong_tac dv_hien_tai ON dv_hien_tai.id = k.don_vi_to_chuc_id
JOIN (
    -- Ép qua text rồi ép lại uuid vì Postgres không có aggregate MIN cho
    -- uuid; do COUNT(*) = 1 nên MIN chỉ trả về giá trị duy nhất của nhóm.
    SELECT khoa_id, MIN(don_vi_id::text)::uuid AS don_vi_id
    FROM khoa_don_vi_theo_doi
    GROUP BY khoa_id
    HAVING COUNT(*) = 1
) t ON t.khoa_id = k.id
JOIN don_vi_cong_tac dv_moi ON dv_moi.id = t.don_vi_id
ORDER BY k.ma_khoa;

-- (b) Khóa có 0 hoặc từ 2 đơn vị theo dõi trở lên -> migration GIỮ NGUYÊN
-- don_vi_dat_hang_id hiện có, cần người dùng gán tay nếu sai.
SELECT
    k.ma_khoa,
    COUNT(t.don_vi_id) AS so_don_vi_theo_doi
FROM khoa_boi_duong k
LEFT JOIN khoa_don_vi_theo_doi t ON t.khoa_id = k.id
GROUP BY k.id, k.ma_khoa
HAVING COUNT(t.don_vi_id) <> 1
ORDER BY k.ma_khoa;

-- (c) Khóa đang ở trạng thái nhap/cho_duyet/tu_choi -> migration bước 4 sẽ
-- chuyển các khóa này thành da_duyet.
SELECT
    k.ma_khoa,
    k.trang_thai,
    dv.ten_don_vi AS don_vi_dat_hang
FROM khoa_boi_duong k
JOIN don_vi_cong_tac dv ON dv.id = k.don_vi_to_chuc_id
WHERE k.trang_thai IN ('nhap', 'cho_duyet', 'tu_choi')
ORDER BY k.ma_khoa;
