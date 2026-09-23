-- =====================================================================
-- Hệ thống thu thập thông tin học viên — DDL PostgreSQL
-- Sinh từ bộ thiết kế: https://claude.ai/artifact/7RrH2dCcRYi6VsUgqVNRoc
-- Board nguồn: MoHinhDuLieu.dc.html (danh mục & hồ sơ), MoHinhKhoaHoc.dc.html
-- (khóa bồi dưỡng & lớp học). Ngày sinh: 2026-09-23.
--
-- Quy ước:
--   - Khóa chính: uuid, sinh bởi gen_random_uuid() (extension pgcrypto).
--   - Mọi bảng "danh mục dùng chung" và "hồ sơ" có trang_thai để soft-disable,
--     không xóa cứng (dữ liệu đã tham chiếu ở báo cáo/hồ sơ khác).
--   - Chuẩn hóa Unicode NFC cho mọi trường tên riêng tiếng Việt được thực hiện
--     Ở TẦNG ỨNG DỤNG trước khi INSERT/UPDATE (Postgres không có hàm NFC dựng
--     sẵn) — xem docs/validation-checklist.md mục "Chuẩn hóa dữ liệu".
--   - Encoding database: UTF8. Khuyến nghị tạo collation ICU tiếng Việt để
--     sắp xếp đúng thứ tự chữ cái có dấu (xem cuối file).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- cho các index GIN .. gin_trgm_ops bên dưới (autocomplete)

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------

CREATE TYPE cap_dia_danh AS ENUM ('tinh_thanh', 'phuong_xa_dac_khu');

CREATE TYPE loai_don_vi AS ENUM ('so_gddt', 'phong_vhxh', 'truong', 'khac');

CREATE TYPE cap_hoc AS ENUM ('mam_non', 'tieu_hoc', 'thcs', 'thpt');

CREATE TYPE trang_thai_active AS ENUM ('active', 'ngung');

CREATE TYPE vai_tro_nguoi_dung AS ENUM (
    'so_gddt', 'phong_vhxh', 'truong', 'hoc_vien', 'quan_tri'
);

CREATE TYPE trinh_do_chuyen_mon AS ENUM (
    'trung_cap', 'cao_dang', 'dai_hoc', 'thac_si', 'tien_si', 'khac'
);

CREATE TYPE trang_thai_ho_so AS ENUM (
    'nhap',        -- đang khai, chưa xác nhận
    'cho_duyet',   -- đã xác nhận (màn XacNhanThongTin), chờ Trường/Sở/Phòng duyệt
    'da_duyet',
    'tu_choi',
    'loi'          -- lỗi hệ thống / dữ liệu cần khai lại (import gán về trạng thái này)
);

CREATE TYPE trang_thai_khoa AS ENUM (
    'nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'dong_dang_ky'
);

CREATE TYPE hinh_thuc_giai_doan AS ENUM (
    'truc_tiep', 'truc_tuyen', 'danh_gia', 'khac'
);

CREATE TYPE trang_thai_lich_hoc AS ENUM (
    'chua_dien_ra', 'dang_dien_ra', 'ket_thuc'
);

CREATE TYPE vai_tro_nhan_su_lop AS ENUM ('giang_vien', 'ho_tro');

CREATE TYPE trang_thai_dang_ky AS ENUM (
    'cho_duyet', 'da_duyet', 'tu_choi', 'da_phan_lop'
);

CREATE TYPE ket_qua_hoc AS ENUM ('dang_hoc', 'dat', 'khong_dat', 'vang');

CREATE TYPE loai_danh_muc_import AS ENUM (
    'dia_danh', 'don_vi_cong_tac', 'mon_hoc', 'phan_lop_hoc_vien'
);

CREATE TYPE trang_thai_import AS ENUM ('dang_xu_ly', 'hoan_thanh', 'loi');


-- =====================================================================
-- PHẦN 1 — DANH MỤC DÙNG CHUNG (board MoHinhDuLieu.dc.html)
-- =====================================================================

-- NhatKyImport được tạo trước vì DiaDanh/DonViCongTac/MonHoc tham chiếu tới nó.
CREATE TABLE nhat_ky_import (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loai_danh_muc       loai_danh_muc_import NOT NULL,
    ten_file_goc        varchar(255) NOT NULL,
    nguoi_import_id     uuid NOT NULL,   -- FK -> nguoi_dung, thêm sau khi bảng tồn tại
    thoi_gian_import    timestamptz NOT NULL DEFAULT now(),
    tong_so_dong        integer NOT NULL DEFAULT 0,
    so_dong_thanh_cong  integer NOT NULL DEFAULT 0,
    so_dong_loi         integer NOT NULL DEFAULT 0,
    file_loi_url        text,
    trang_thai          trang_thai_import NOT NULL DEFAULT 'dang_xu_ly',

    CONSTRAINT chk_import_dong_hop_le
        CHECK (so_dong_thanh_cong + so_dong_loi <= tong_so_dong)
);

CREATE TABLE dia_danh (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ma                  varchar(20) NOT NULL,          -- mã hành chính
    ten                 varchar(255) NOT NULL,
    cap                 cap_dia_danh NOT NULL,
    parent_id           uuid REFERENCES dia_danh(id),  -- NULL nếu cấp=tinh_thanh
    trang_thai          trang_thai_active NOT NULL DEFAULT 'active',
    nguon_import_id     uuid REFERENCES nhat_ky_import(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_dia_danh_ma UNIQUE (ma),
    CONSTRAINT chk_dia_danh_parent
        CHECK ( (cap = 'tinh_thanh' AND parent_id IS NULL)
             OR (cap = 'phuong_xa_dac_khu' AND parent_id IS NOT NULL) )
);

CREATE INDEX idx_dia_danh_parent ON dia_danh(parent_id);
CREATE INDEX idx_dia_danh_cap ON dia_danh(cap);
CREATE INDEX idx_dia_danh_ten_trgm ON dia_danh USING gin (ten gin_trgm_ops);
-- ^ cần "CREATE EXTENSION pg_trgm;" nếu dùng tìm kiếm gần đúng cho autocomplete.

CREATE TABLE don_vi_cong_tac (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ma_don_vi           varchar(30),
    ten_don_vi          varchar(255) NOT NULL,
    loai_don_vi         loai_don_vi NOT NULL,
    dia_ban_id          uuid NOT NULL REFERENCES dia_danh(id),   -- cấp phuong_xa_dac_khu
    don_vi_cha_id       uuid REFERENCES don_vi_cong_tac(id),
    trang_thai          trang_thai_active NOT NULL DEFAULT 'active',
    nguon_import_id     uuid REFERENCES nhat_ky_import(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_don_vi_ma UNIQUE (ma_don_vi),
    CONSTRAINT chk_don_vi_khong_tu_lam_cha CHECK (id IS DISTINCT FROM don_vi_cha_id)
);

CREATE INDEX idx_don_vi_loai ON don_vi_cong_tac(loai_don_vi);
CREATE INDEX idx_don_vi_dia_ban ON don_vi_cong_tac(dia_ban_id);
CREATE INDEX idx_don_vi_cha ON don_vi_cong_tac(don_vi_cha_id);
CREATE INDEX idx_don_vi_ten_trgm ON don_vi_cong_tac USING gin (ten_don_vi gin_trgm_ops);

CREATE TABLE mon_hoc (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ten_mon             varchar(255) NOT NULL,
    cap_hoc             cap_hoc NOT NULL,
    trang_thai          trang_thai_active NOT NULL DEFAULT 'active',
    nguon_import_id     uuid REFERENCES nhat_ky_import(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_mon_hoc UNIQUE (ten_mon, cap_hoc)
);

CREATE INDEX idx_mon_hoc_cap ON mon_hoc(cap_hoc);

-- ---------------------------------------------------------------------
-- NguoiDung (đặt sau don_vi_cong_tac vì có FK tới nó; hoc_vien_id thêm
-- bằng ALTER sau khi bảng hoc_vien được tạo, để tránh vòng lặp phụ thuộc)
-- ---------------------------------------------------------------------
CREATE TABLE nguoi_dung (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ho_ten              varchar(255) NOT NULL,
    email               varchar(255) NOT NULL,
    vai_tro             vai_tro_nguoi_dung NOT NULL,
    don_vi_id           uuid REFERENCES don_vi_cong_tac(id),  -- NULL nếu vai_tro='hoc_vien'
    hoc_vien_id         uuid,                                  -- FK thêm sau (xem PHẦN 2)
    mat_khau_hash       varchar(255) NOT NULL,
    phai_doi_mat_khau   boolean NOT NULL DEFAULT true,
    trang_thai          trang_thai_active NOT NULL DEFAULT 'active',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_nguoi_dung_email UNIQUE (email),
    CONSTRAINT uq_nguoi_dung_hoc_vien UNIQUE (hoc_vien_id),
    CONSTRAINT chk_nguoi_dung_scope CHECK (
        (vai_tro = 'hoc_vien' AND don_vi_id IS NULL AND hoc_vien_id IS NOT NULL)
        OR
        (vai_tro <> 'hoc_vien' AND don_vi_id IS NOT NULL AND hoc_vien_id IS NULL)
    )
);

CREATE INDEX idx_nguoi_dung_vai_tro ON nguoi_dung(vai_tro);
CREATE INDEX idx_nguoi_dung_don_vi ON nguoi_dung(don_vi_id);

ALTER TABLE nhat_ky_import
    ADD CONSTRAINT fk_import_nguoi_import
    FOREIGN KEY (nguoi_import_id) REFERENCES nguoi_dung(id);

CREATE INDEX idx_import_nguoi ON nhat_ky_import(nguoi_import_id);
CREATE INDEX idx_import_loai ON nhat_ky_import(loai_danh_muc);


-- =====================================================================
-- PHẦN 2 — HỒ SƠ HỌC VIÊN (board MoHinhDuLieu.dc.html)
-- =====================================================================

CREATE TABLE hoc_vien (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Định danh
    ho_ten                  varchar(255) NOT NULL,
    so_dinh_danh_ca_nhan    char(12) NOT NULL,
    ngay_sinh               smallint NOT NULL,
    thang_sinh              smallint NOT NULL,
    nam_sinh                smallint NOT NULL,
    gioi_tinh               varchar(20),

    -- Nơi sinh / cư trú (danh mục dùng chung)
    noi_sinh_id             uuid NOT NULL REFERENCES dia_danh(id),      -- cấp tinh_thanh
    phuong_xa_id            uuid NOT NULL REFERENCES dia_danh(id),      -- cấp phuong_xa_dac_khu

    -- Công tác
    don_vi_cong_tac_id      uuid NOT NULL REFERENCES don_vi_cong_tac(id),

    -- Liên hệ (bắt buộc)
    so_dien_thoai_lien_he   varchar(20) NOT NULL,
    email_lien_he           varchar(255) NOT NULL,

    -- Trình độ & chuyên môn
    trinh_do_chuyen_mon     trinh_do_chuyen_mon NOT NULL,
    trinh_do_chuyen_mon_khac varchar(255),   -- chỉ khi trinh_do_chuyen_mon = 'khac'
    chuyen_mon_dao_tao      varchar(255) NOT NULL,   -- tự do, có gợi ý ở tầng API, KHÔNG FK
    cap_giang_day           cap_hoc NOT NULL,
    mon_giang_day_id        uuid NOT NULL REFERENCES mon_hoc(id),

    -- Vòng đời hồ sơ & duyệt
    trang_thai              trang_thai_ho_so NOT NULL DEFAULT 'nhap',
    nguoi_duyet_id           uuid REFERENCES nguoi_dung(id),
    cap_duyet_thuc_te        vai_tro_nguoi_dung,   -- vai_tro của nguoi_duyet_id tại thời điểm duyệt
    ngay_duyet               timestamptz,

    -- Thông báo
    email_ban_sao_da_gui_at  timestamptz,

    -- Audit
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now(),
    created_by                uuid REFERENCES nguoi_dung(id),   -- = tài khoản NguoiDung của chính học viên

    CONSTRAINT uq_hoc_vien_ddcn UNIQUE (so_dinh_danh_ca_nhan),
    CONSTRAINT chk_hoc_vien_ddcn_12_so
        CHECK (so_dinh_danh_ca_nhan ~ '^[0-9]{12}$'),
    CONSTRAINT chk_hoc_vien_ngay_sinh CHECK (ngay_sinh BETWEEN 1 AND 31),
    CONSTRAINT chk_hoc_vien_thang_sinh CHECK (thang_sinh BETWEEN 1 AND 12),
    CONSTRAINT chk_hoc_vien_nam_sinh
        CHECK (nam_sinh BETWEEN 1940 AND date_part('year', now())::int - 15),
        -- độ tuổi tối thiểu 15 — điều chỉnh theo quy định thực tế nếu khác
    CONSTRAINT chk_hoc_vien_ngay_sinh_hop_le
        CHECK (make_date(nam_sinh, thang_sinh, ngay_sinh) IS NOT NULL),
        -- bắt lỗi 31/04, 30/02, 29/02 năm không nhuận, v.v. Postgres tự raise
        -- lỗi khi make_date() nhận ngày không tồn tại; ràng buộc này chủ yếu
        -- để tài liệu hóa ý định — chặn thật sự nên làm ở tầng ứng dụng để
        -- trả thông báo lỗi rõ ràng thay vì lỗi SQL khó hiểu.
    CONSTRAINT chk_hoc_vien_trinh_do_khac
        CHECK ( (trinh_do_chuyen_mon = 'khac' AND trinh_do_chuyen_mon_khac IS NOT NULL)
             OR (trinh_do_chuyen_mon <> 'khac') ),
    CONSTRAINT chk_hoc_vien_duyet_dong_bo
        CHECK ( (trang_thai IN ('da_duyet', 'tu_choi') AND nguoi_duyet_id IS NOT NULL)
             OR (trang_thai NOT IN ('da_duyet', 'tu_choi')) )
);

CREATE INDEX idx_hoc_vien_don_vi ON hoc_vien(don_vi_cong_tac_id);
CREATE INDEX idx_hoc_vien_trang_thai ON hoc_vien(trang_thai);
CREATE INDEX idx_hoc_vien_cap_giang_day ON hoc_vien(cap_giang_day);
CREATE INDEX idx_hoc_vien_phuong_xa ON hoc_vien(phuong_xa_id);
CREATE INDEX idx_hoc_vien_ho_ten_trgm ON hoc_vien USING gin (ho_ten gin_trgm_ops);

ALTER TABLE nguoi_dung
    ADD CONSTRAINT fk_nguoi_dung_hoc_vien
    FOREIGN KEY (hoc_vien_id) REFERENCES hoc_vien(id);


-- =====================================================================
-- PHẦN 3 — KHÓA BỒI DƯỠNG & LỚP HỌC (board MoHinhKhoaHoc.dc.html)
-- =====================================================================

CREATE TABLE khoa_boi_duong (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ma_khoa             varchar(30) NOT NULL,
    ten_khoa            varchar(255) NOT NULL,
    don_vi_to_chuc_id   uuid NOT NULL REFERENCES don_vi_cong_tac(id),  -- = Trường tạo khóa
    dia_diem            varchar(255),
    thoi_gian_bat_dau   date NOT NULL,
    thoi_gian_ket_thuc  date NOT NULL,
    trang_thai          trang_thai_khoa NOT NULL DEFAULT 'nhap',
    nguoi_duyet_id      uuid REFERENCES nguoi_dung(id),
    cap_duyet_thuc_te   vai_tro_nguoi_dung,
    ngay_duyet          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_khoa_ma UNIQUE (ma_khoa),
    CONSTRAINT chk_khoa_thoi_gian CHECK (thoi_gian_ket_thuc >= thoi_gian_bat_dau)
);

CREATE INDEX idx_khoa_don_vi ON khoa_boi_duong(don_vi_to_chuc_id);
CREATE INDEX idx_khoa_trang_thai ON khoa_boi_duong(trang_thai);

CREATE TABLE giai_doan_khoa (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    khoa_id             uuid NOT NULL REFERENCES khoa_boi_duong(id) ON DELETE CASCADE,
    thu_tu              integer NOT NULL,
    ten_giai_doan       varchar(255) NOT NULL,
    hinh_thuc           hinh_thuc_giai_doan NOT NULL,
    thoi_gian_bat_dau   date NOT NULL,
    thoi_gian_ket_thuc  date NOT NULL,
    trang_thai          trang_thai_active NOT NULL DEFAULT 'active',

    CONSTRAINT uq_giai_doan_thu_tu UNIQUE (khoa_id, thu_tu),
    CONSTRAINT chk_giai_doan_thoi_gian CHECK (thoi_gian_ket_thuc >= thoi_gian_bat_dau)
);

CREATE INDEX idx_giai_doan_khoa ON giai_doan_khoa(khoa_id);

CREATE TABLE lop_hoc (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    khoa_id             uuid NOT NULL REFERENCES khoa_boi_duong(id) ON DELETE CASCADE,
    ten_lop             varchar(255) NOT NULL,
    si_so_toi_da        integer,
    trang_thai          trang_thai_active NOT NULL DEFAULT 'active',

    CONSTRAINT chk_lop_si_so CHECK (si_so_toi_da IS NULL OR si_so_toi_da > 0)
);

CREATE INDEX idx_lop_khoa ON lop_hoc(khoa_id);

CREATE TABLE lich_hoc_lop (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lop_id                  uuid NOT NULL REFERENCES lop_hoc(id) ON DELETE CASCADE,
    giai_doan_id            uuid NOT NULL REFERENCES giai_doan_khoa(id) ON DELETE CASCADE,
    thoi_gian_bat_dau       timestamptz NOT NULL,
    thoi_gian_ket_thuc      timestamptz NOT NULL,
    dia_diem_hoac_link      varchar(500),
    trang_thai              trang_thai_lich_hoc NOT NULL DEFAULT 'chua_dien_ra',

    CONSTRAINT uq_lich_hoc_lop_giai_doan UNIQUE (lop_id, giai_doan_id),
    CONSTRAINT chk_lich_hoc_thoi_gian CHECK (thoi_gian_ket_thuc > thoi_gian_bat_dau)
);

CREATE INDEX idx_lich_hoc_lop ON lich_hoc_lop(lop_id);
CREATE INDEX idx_lich_hoc_giai_doan ON lich_hoc_lop(giai_doan_id);

CREATE TABLE lop_hoc_nhan_su (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lop_id              uuid NOT NULL REFERENCES lop_hoc(id) ON DELETE CASCADE,
    ho_ten              varchar(255) NOT NULL,
    vai_tro             vai_tro_nhan_su_lop NOT NULL,
    so_dien_thoai       varchar(20)
);

CREATE INDEX idx_nhan_su_lop ON lop_hoc_nhan_su(lop_id);

CREATE TABLE dang_ky_hoc (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hoc_vien_id         uuid NOT NULL REFERENCES hoc_vien(id),
    khoa_id             uuid NOT NULL REFERENCES khoa_boi_duong(id),
    lop_id              uuid REFERENCES lop_hoc(id),   -- NULL cho tới khi phân lớp
    ngay_dang_ky        date NOT NULL DEFAULT current_date,
    trang_thai          trang_thai_dang_ky NOT NULL DEFAULT 'cho_duyet',
    ket_qua             ket_qua_hoc,
    ngay_hoan_thanh     date,

    CONSTRAINT uq_dang_ky_hoc_vien_khoa UNIQUE (hoc_vien_id, khoa_id),
    CONSTRAINT chk_dang_ky_lop_thuoc_khoa
        -- lop_id (nếu có) phải thuộc đúng khoa_id — thực thi bằng trigger,
        -- xem TRIGGER bên dưới (không biểu diễn được bằng CHECK đơn thuần
        -- vì cần tra cứu bảng lop_hoc).
        CHECK (true)
);

CREATE INDEX idx_dang_ky_hoc_vien ON dang_ky_hoc(hoc_vien_id);
CREATE INDEX idx_dang_ky_khoa ON dang_ky_hoc(khoa_id);
CREATE INDEX idx_dang_ky_lop ON dang_ky_hoc(lop_id);

CREATE OR REPLACE FUNCTION trg_dang_ky_lop_thuoc_khoa() RETURNS trigger AS $$
BEGIN
    IF NEW.lop_id IS NOT NULL THEN
        PERFORM 1 FROM lop_hoc WHERE id = NEW.lop_id AND khoa_id = NEW.khoa_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'lop_id % không thuộc khoa_id %', NEW.lop_id, NEW.khoa_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dang_ky_hoc_kiem_tra_lop
    BEFORE INSERT OR UPDATE ON dang_ky_hoc
    FOR EACH ROW EXECUTE FUNCTION trg_dang_ky_lop_thuoc_khoa();


-- =====================================================================
-- updated_at TRIGGER DÙNG CHUNG
-- =====================================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dia_danh_updated_at BEFORE UPDATE ON dia_danh
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_don_vi_updated_at BEFORE UPDATE ON don_vi_cong_tac
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_mon_hoc_updated_at BEFORE UPDATE ON mon_hoc
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_nguoi_dung_updated_at BEFORE UPDATE ON nguoi_dung
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_hoc_vien_updated_at BEFORE UPDATE ON hoc_vien
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_khoa_updated_at BEFORE UPDATE ON khoa_boi_duong
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();


-- =====================================================================
-- GHI CHÚ TRIỂN KHAI
-- =====================================================================
-- 1. Tiếng Việt & sắp xếp: tạo collation ICU để ORDER BY ten/ho_ten ra đúng
--    thứ tự chữ cái có dấu:
--      CREATE COLLATION vi_vn (provider = icu, locale = 'vi-u-co-standard');
--    rồi thêm "COLLATE vi_vn" vào các cột varchar cần sắp xếp (ten, ho_ten,
--    ten_don_vi, ten_khoa, ten_lop...) — không bắt buộc cho phiên bản đầu,
--    có thể thêm bằng ALTER COLUMN sau.
--
-- 2. gin_trgm_ops (tìm kiếm gần đúng cho autocomplete Đơn vị công tác,
--    chuyên môn đào tạo, tên học viên) đã có "CREATE EXTENSION pg_trgm"
--    ở đầu file — chạy trước mọi CREATE INDEX ... USING gin (... gin_trgm_ops).
--
-- 3. "chuyen_mon_dao_tao" cố ý KHÔNG có FK/danh mục — theo quyết định thiết
--    kế: chấp nhận dữ liệu không đồng nhất 100%, gợi ý autocomplete lấy từ
--    SELECT DISTINCT chuyen_mon_dao_tao ... (tầng ứng dụng), không chuẩn hóa.
--
-- 4. Chuẩn hóa NFC: thực hiện ở tầng ứng dụng (Node.js: String.prototype.
--    normalize('NFC')) trước khi INSERT/UPDATE các cột: ho_ten, ten,
--    ten_don_vi, ten_mon, ten_khoa, ten_lop, ten_giai_doan. Không thực thi
--    được bằng CHECK constraint thuần Postgres.
-- =====================================================================
