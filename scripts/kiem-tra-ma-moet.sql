-- Kiểm tra hiện trạng mã định danh MOET + SĐT trước khi chuẩn hóa.
-- CHỈ ĐỌC: chạy trong transaction READ ONLY, kết thúc bằng ROLLBACK.
-- Chỉ trả về số đếm — không xuất họ tên/mã/SĐT (không lộ PII).
BEGIN TRANSACTION READ ONLY;

\echo '== Q1. Phân bố độ dài mã MOET, có/không số 0 đầu, có ký tự không phải số =='
SELECT length(ma_dinh_danh_moet)              AS do_dai,
       (ma_dinh_danh_moet LIKE '0%')          AS bat_dau_0,
       (ma_dinh_danh_moet !~ '^[0-9]+$')      AS co_ky_tu_la,
       nguon_tao,
       count(*)                               AS so_hv
FROM hoc_vien
WHERE ma_dinh_danh_moet IS NOT NULL
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3, 4;

\echo '== Q2. Tổng quan: tổng HV / có mã MOET / có CCCD / có SĐT =='
SELECT count(*)                                         AS tong_hv,
       count(ma_dinh_danh_moet)                         AS co_ma_moet,
       count(so_dinh_danh_ca_nhan)                      AS co_cccd,
       count(NULLIF(trim(so_dien_thoai_lien_he), ''))   AS co_sdt
FROM hoc_vien;

\echo '== Q3. Mã bị TRÙNG khi bỏ số 0 đầu (1 người có 2 hồ sơ, hoặc 2 người khác nhau) =='
SELECT count(*) AS so_nhom_trung, coalesce(sum(n), 0) AS so_hv_lien_quan
FROM (
  SELECT ltrim(ma_dinh_danh_moet, '0') AS k, count(*) AS n
  FROM hoc_vien
  WHERE ma_dinh_danh_moet IS NOT NULL
  GROUP BY 1 HAVING count(*) > 1
) t;

\echo '== Q4. Tên đăng nhập của học viên đang là gì? =='
SELECT CASE
         WHEN nd.ten_dang_nhap = hv.so_dinh_danh_ca_nhan THEN 'cccd'
         WHEN nd.ten_dang_nhap = hv.ma_dinh_danh_moet    THEN 'ma_moet_nguyen_van'
         WHEN ltrim(nd.ten_dang_nhap, '0') = ltrim(hv.ma_dinh_danh_moet, '0')
                                                         THEN 'ma_moet_lech_so_0'
         ELSE 'khac'
       END                                   AS ten_dang_nhap_la,
       (nd.ten_dang_nhap LIKE '0%')          AS tdn_bat_dau_0,
       count(*)                              AS so_tk,
       count(nd.dang_nhap_lan_cuoi)          AS da_tung_dang_nhap,
       count(*) FILTER (WHERE nd.phai_doi_mat_khau = false) AS da_doi_mat_khau
FROM nguoi_dung nd
JOIN hoc_vien hv ON hv.id = nd.hoc_vien_id
WHERE nd.vai_tro = 'hoc_vien'
GROUP BY 1, 2
ORDER BY 1, 2;

\echo '== Q5. Học viên CHƯA có tài khoản (không đăng nhập được) =='
SELECT (hv.ma_dinh_danh_moet LIKE '0%') AS ma_bat_dau_0, count(*) AS so_hv
FROM hoc_vien hv
LEFT JOIN nguoi_dung nd ON nd.hoc_vien_id = hv.id
WHERE nd.id IS NULL
GROUP BY 1;

\echo '== Q6. Dấu hiệu đăng nhập thất bại: đang có lần sai / đang bị khóa =='
SELECT (hv.ma_dinh_danh_moet LIKE '0%')                     AS ma_bat_dau_0,
       count(*) FILTER (WHERE nd.so_lan_dang_nhap_sai > 0)  AS co_lan_sai,
       count(*) FILTER (WHERE nd.khoa_den > now())          AS dang_bi_khoa,
       count(*) FILTER (WHERE nd.dang_nhap_lan_cuoi IS NULL) AS chua_dang_nhap
FROM nguoi_dung nd
JOIN hoc_vien hv ON hv.id = nd.hoc_vien_id
WHERE nd.vai_tro = 'hoc_vien'
GROUP BY 1;

\echo '== Q7. Kết quả khảo sát theo trạng thái (gắn với hoc_vien_id) =='
SELECT kq.loai, kq.trang_thai, kq.nguon,
       (hv.ma_dinh_danh_moet LIKE '0%') AS ma_bat_dau_0,
       count(*) AS so_ban_ghi
FROM ket_qua_khao_sat kq
JOIN hoc_vien hv ON hv.id = kq.hoc_vien_id
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3, 4;

\echo '== Q8. SĐT: độ dài sau khi bỏ ký tự lạ, và SĐT TRÙNG giữa nhiều học viên =='
WITH sdt AS (
  SELECT id,
         CASE
           WHEN d ~ '^84[0-9]{9}$' THEN '0' || substr(d, 3)
           WHEN d ~ '^[1-9][0-9]{8}$' THEN '0' || d   -- mất số 0 do Excel
           ELSE d
         END AS chuan
  FROM (SELECT id, regexp_replace(coalesce(so_dien_thoai_lien_he, ''), '\D', '', 'g') AS d
        FROM hoc_vien) x
  WHERE d <> ''
)
SELECT 'do_dai_' || length(chuan) AS chi_so, count(*) AS gia_tri FROM sdt GROUP BY 1
UNION ALL
SELECT 'so_sdt_bi_trung', count(*) FROM (SELECT chuan FROM sdt GROUP BY 1 HAVING count(*) > 1) t
UNION ALL
SELECT 'so_hv_dung_sdt_trung', coalesce(sum(n), 0)
  FROM (SELECT count(*) AS n FROM sdt GROUP BY chuan HAVING count(*) > 1) t
ORDER BY 1;

ROLLBACK;
