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

CREATE TYPE nguon_tao_ho_so AS ENUM ('tu_dang_ky', 'import_moet');
-- 'tu_dang_ky'  : học viên tự truy cập khai báo (form đầy đủ 1 lần)
-- 'import_moet' : Quản trị hệ thống import từ danh sách nhân sự tiếp nhận
--                 (CSDL ngành MOET) — hồ sơ tạo THIẾU nhiều trường, người
--                 dùng tự bổ sung sau khi đăng nhập lần đầu.

CREATE TYPE loai_danh_muc_import AS ENUM (
    'dia_danh', 'don_vi_cong_tac', 'mon_hoc', 'phan_lop_hoc_vien',
    'ho_so_nhan_su_moet',
    'tai_khoan_vle',  -- T15 (mo-rong-nls-an-giang.md, 2026-09-28) — thêm SAU CÙNG (migration riêng)
    'ket_qua_danh_gia',  -- T5 (mo-rong-nls-an-giang.md, 2026-09-29) — thêm SAU CÙNG (migration riêng)
    'lop_va_lich_hoc',  -- T6 (mo-rong-nls-an-giang.md, 2026-09-29) — thêm SAU CÙNG (migration riêng)
    'tai_khoan_don_vi'  -- Tài khoản đơn vị (2026-10-03, ADR 0002) — migration riêng
);

-- T5 (mo-rong-nls-an-giang.md, 2026-09-29): mức năng lực đầu vào/đầu ra của
-- dang_ky_hoc, import qua loai_danh_muc_import.ket_qua_danh_gia.
CREATE TYPE muc_nang_luc AS ENUM ('co_ban', 'thanh_thao', 'nang_cao');

CREATE TYPE trang_thai_import AS ENUM ('dang_xu_ly', 'hoan_thanh', 'loi');

-- M9 (2026-10-01): thêm 'email_xac_minh'/'dat_lai_mat_khau' (ALTER TYPE ADD
-- VALUE trong migration riêng, chạy trước migration dùng giá trị mới — xem
-- schema.prisma) để 2 sự kiện này (làn "ưu tiên cao", gửi ngay không qua
-- hàng đợi) cũng ghi nhat_ky_thong_bao, phục vụ đếm hạn mức/ngày EMAIL_DAILY_
-- LIMIT (PHẦN 4 dưới). Danh sách dưới đây CHƯA phản ánh 'yeu_cau_ho_tro_tra_loi'
-- (M8) — xem CONTEXT.md ghi chú lệch pha đã biết.
CREATE TYPE loai_su_kien_thong_bao AS ENUM (
    'hoc_vien_xac_nhan',      -- gửi bản sao dữ liệu sau khi học viên xác nhận
    'hoc_vien_duyet',         -- kết quả duyệt hồ sơ (đã duyệt/từ chối)
    'khoa_boi_duong_duyet',   -- kết quả duyệt khóa bồi dưỡng
    'dang_ky_hoc_phan_lop',   -- thông báo lớp/lịch học sau khi được phân lớp
    'dang_ky_hoc_ket_qua',    -- thông báo kết quả khóa học
    'email_xac_minh',         -- M9: xác minh email liên hệ (làn ưu tiên cao)
    'dat_lai_mat_khau',       -- M9: đặt lại mật khẩu (làn ưu tiên cao)
    'kich_hoat_tai_khoan'     -- 2026-10-03 (ADR 0002): link kích hoạt tài khoản đơn vị
);

CREATE TYPE trang_thai_gui_thong_bao AS ENUM ('thanh_cong', 'that_bai');

-- M9 (2026-10-01): trạng thái 1 dòng hang_doi_email (PHẦN 4 dưới) — khác
-- trang_thai_gui_thong_bao vì hàng đợi cần phân biệt "đang chờ" (cho_gui).
CREATE TYPE trang_thai_hang_doi_email AS ENUM ('cho_gui', 'thanh_cong', 'that_bai');

-- T14 (mo-rong-nls-an-giang.md, 2026-09-28): đợt xác nhận cho hồ sơ
-- import_moet — xem PHẦN 2b bên dưới.
CREATE TYPE loai_dot_xac_nhan AS ENUM ('kiem_tra_bo_sung', 'xac_nhan_truoc_danh_gia');
-- 2026-10-02 (migration 20261002120000): học viên tự chọn, gửi sang hệ thống khảo sát qua SSO.
CREATE TYPE doi_tuong_hoc_vien AS ENUM ('giao_vien', 'can_bo_quan_ly');


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
    email               varchar(255),   -- NULL cho tới khi tài khoản hoc_vien tự bổ sung
    ten_dang_nhap       varchar(50) NOT NULL,
    -- Định danh đăng nhập ỔN ĐỊNH, gán 1 LẦN lúc tạo tài khoản, KHÔNG tự đổi
    -- theo dữ liệu hồ sơ về sau (kể cả khi hoc_vien cập nhật CCCD) — vì quan
    -- hệ giữa Mã định danh CSDL MOET và CCCD chưa được xác nhận là trùng
    -- nhau tuyệt đối cho mọi người:
    --   vai_tro='hoc_vien', nguon_tao='tu_dang_ky'  → = so_dinh_danh_ca_nhan lúc đăng ký
    --   vai_tro='hoc_vien', nguon_tao='import_moet' → = ma_dinh_danh_moet lúc import
    --   vai_tro khác                                → do Quản trị hệ thống gán khi cấp tài khoản
    vai_tro             vai_tro_nguoi_dung NOT NULL,
    don_vi_id           uuid REFERENCES don_vi_cong_tac(id),  -- NULL nếu vai_tro='hoc_vien' hoặc 'quan_tri'
    hoc_vien_id         uuid,                                  -- FK thêm sau (xem PHẦN 2)
    mat_khau_hash       varchar(255) NOT NULL,
    phai_doi_mat_khau   boolean NOT NULL DEFAULT true,
    trang_thai          trang_thai_active NOT NULL DEFAULT 'active',

    -- Thêm 2026-09-28 (T1 bảo mật đăng nhập, mo-rong-nls-an-giang.md): đếm số
    -- lần sai liên tiếp, khóa tạm 15 phút sau 5 lần sai — xem AuthService.dangNhap.
    so_lan_dang_nhap_sai smallint NOT NULL DEFAULT 0,
    khoa_den            timestamptz,
    -- Dùng cho báo cáo "chưa đăng nhập" (T14) — cập nhật mỗi lần đăng nhập thành công.
    dang_nhap_lan_cuoi  timestamptz,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_nguoi_dung_email UNIQUE (email),
    CONSTRAINT uq_nguoi_dung_ten_dang_nhap UNIQUE (ten_dang_nhap),
    CONSTRAINT uq_nguoi_dung_hoc_vien UNIQUE (hoc_vien_id),
    CONSTRAINT chk_nguoi_dung_scope CHECK (
        (vai_tro = 'hoc_vien' AND don_vi_id IS NULL AND hoc_vien_id IS NOT NULL)
        OR
        (vai_tro = 'quan_tri' AND hoc_vien_id IS NULL)
            -- don_vi_id KHÔNG bị ràng buộc cho quan_tri (được phép NULL —
            -- phạm vi quan_tri là toàn hệ thống, không nên bắt gắn giả vào
            -- 1 đơn vị nào; sửa 2026-09-24 sau khi bản seed đầu tiên phải
            -- tạo "đơn vị bootstrap" giả chỉ để thỏa constraint cũ)
        OR
        (vai_tro NOT IN ('hoc_vien', 'quan_tri') AND don_vi_id IS NOT NULL AND hoc_vien_id IS NULL)
    ),
    -- 2026-10-03 (ADR 0002): chỉ quan_tri bắt buộc email; tài khoản đơn vị
    -- (so_gddt/phong_vhxh/truong) có thể chưa có email (cấp mật khẩu tạm).
    CONSTRAINT chk_nguoi_dung_email_bat_buoc
        CHECK (vai_tro <> 'quan_tri' OR email IS NOT NULL)
);

CREATE INDEX idx_nguoi_dung_vai_tro ON nguoi_dung(vai_tro);
CREATE INDEX idx_nguoi_dung_don_vi ON nguoi_dung(don_vi_id);
-- 2026-10-03 (ADR 0002): 1 tài khoản quản lý / đơn vị.
CREATE UNIQUE INDEX uq_nguoi_dung_don_vi_quan_ly ON nguoi_dung(don_vi_id)
    WHERE vai_tro IN ('so_gddt', 'phong_vhxh', 'truong');
-- token_xac_thuc (M9, chưa có trong file này — lệch pha đã biết, xem
-- CONTEXT.md): từ 2026-10-03 có thêm nguoi_dung_id (nullable, FK
-- nguoi_dung ON DELETE CASCADE), hoc_vien_id nullable, CHECK
-- chk_token_xac_thuc_chu_the: num_nonnulls(hoc_vien_id, nguoi_dung_id) = 1;
-- enum loai_token_xac_thuc thêm 'kich_hoat_tai_khoan'.

ALTER TABLE nhat_ky_import
    ADD CONSTRAINT fk_import_nguoi_import
    FOREIGN KEY (nguoi_import_id) REFERENCES nguoi_dung(id);

CREATE INDEX idx_import_nguoi ON nhat_ky_import(nguoi_import_id);
CREATE INDEX idx_import_loai ON nhat_ky_import(loai_danh_muc);

-- Thêm 2026-09-28: JWT vốn stateless — bảng này là cơ chế thu hồi cho
-- POST /auth/dang-xuat (trước đó endpoint tồn tại nhưng không làm gì
-- thật). Ghi 1 dòng mỗi lần đăng xuất, giữ tới khi token hết hạn tự
-- nhiên (het_han = hạn gốc của token, không phải hạn của dòng ghi) rồi
-- có thể dọn bằng job định kỳ dựa trên idx_token_thu_hoi_het_han.
CREATE TABLE token_thu_hoi (
    jti             uuid PRIMARY KEY,
    nguoi_dung_id   uuid NOT NULL REFERENCES nguoi_dung(id),
    het_han         timestamptz NOT NULL,
    thu_hoi_luc     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_thu_hoi_nguoi_dung ON token_thu_hoi(nguoi_dung_id);
CREATE INDEX idx_token_thu_hoi_het_han ON token_thu_hoi(het_han);

-- T1 (bảo mật đăng nhập, 2026-09-28): nhật ký cho POST
-- /nguoi-dung/{id}/dat-lai-mat-khau — ai đặt lại mật khẩu cho ai, lúc nào.
-- Không có trong mo-rong-nls-an-giang.md (chỉ nói "ghi nhật ký") — bảng tối
-- thiểu tự thêm, flagged trong self-review.
CREATE TABLE nhat_ky_dat_lai_mat_khau (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nguoi_dung_id   uuid NOT NULL REFERENCES nguoi_dung(id),
    thuc_hien_boi   uuid NOT NULL REFERENCES nguoi_dung(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nhat_ky_dlmk_nguoi_dung ON nhat_ky_dat_lai_mat_khau(nguoi_dung_id);


-- =====================================================================
-- PHẦN 2 — HỒ SƠ HỌC VIÊN (board MoHinhDuLieu.dc.html)
-- =====================================================================

CREATE TABLE hoc_vien (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Nguồn tạo hồ sơ — quyết định field nào bắt buộc lúc tạo (xem
    -- validation-checklist.md); DB chỉ ràng buộc phần chung cho cả 2 luồng,
    -- phần còn lại bắt buộc có điều kiện ở tầng API.
    nguon_tao               nguon_tao_ho_so NOT NULL DEFAULT 'tu_dang_ky',

    -- Định danh
    ho_ten                  varchar(255) NOT NULL,
    so_dinh_danh_ca_nhan    char(12),           -- NULL cho tới khi bổ sung (luồng import_moet)
    ma_dinh_danh_moet       varchar(20),        -- chỉ có ở luồng import_moet; KHÔNG giả định trùng CCCD
    ngay_sinh               smallint NOT NULL,
    thang_sinh              smallint NOT NULL,
    nam_sinh                smallint NOT NULL,
    gioi_tinh               varchar(20),
    chuc_vu                 varchar(100),       -- vd: TTCM, Giáo viên, Nhân viên — tự do (từ import)
    doi_tuong               doi_tuong_hoc_vien, -- 2026-10-02: học viên tự chọn; NULL = chưa chọn -> hồ sơ CHƯA đầy đủ

    -- Nơi sinh / cư trú — không có trong danh sách tiếp nhận MOET, học viên
    -- tự bổ sung sau. LƯU Ý: phần dưới đây đã được cập nhật qua Prisma trực
    -- tiếp (2026-09-30, 2026-10-01) nhanh hơn file DDL tham khảo này — xem
    -- backend/prisma/schema.prisma làm nguồn chân lý runtime nếu có lệch.
    --
    -- Deprecated (giữ để không mất dữ liệu cũ, KHÔNG dùng trong luồng mới,
    -- thay bởi noi_sinh_tinh/huyen/xa bên dưới):
    noi_sinh_id             uuid REFERENCES dia_danh(id),      -- cấp tinh_thanh
    phuong_xa_id            uuid REFERENCES dia_danh(id),      -- cấp phuong_xa_dac_khu

    -- T17 (2026-10-01): nơi sinh dạng TEXT TỰ DO, tách 3 trường — giấy khai
    -- sinh có thể ghi theo địa giới hành chính CŨ, khác địa giới HIỆN TẠI mà
    -- dia_danh quản lý — không ràng buộc FK. Hoàn toàn TÙY CHỌN (không tính
    -- vào "Hồ sơ đầy đủ"). Thay thế cột "noi_sinh" (text 500 ký tự, 1 ô duy
    -- nhất, thêm 2026-09-30 rồi tách ngay hôm sau theo yêu cầu thực tế).
    noi_sinh_tinh           varchar(255),
    noi_sinh_huyen          varchar(255),
    noi_sinh_xa             varchar(255),

    -- Cư trú (2026-09-30) — TÙY CHỌN, dùng đúng địa giới hành chính HIỆN TẠI
    -- (FK dia_danh, khác nơi sinh có thể ghi theo địa giới cũ):
    cu_tru_tinh_id          uuid REFERENCES dia_danh(id),      -- cấp tinh_thanh
    cu_tru_phuong_xa_id     uuid REFERENCES dia_danh(id),      -- cấp phuong_xa_dac_khu

    -- Công tác — CÓ trong cả 2 luồng (self: chọn tay; import: khớp theo cột "Đơn vị")
    don_vi_cong_tac_id      uuid NOT NULL REFERENCES don_vi_cong_tac(id),

    -- Liên hệ — SĐT có ở cả 2 luồng; email KHÔNG có trong danh sách MOET.
    -- Sửa 2026-09-30: SĐT NOT NULL vẫn đúng cho tu_dang_ky (bắt buộc lúc tự
    -- đăng ký), nhưng import_moet cho phép NULL lúc import — danh sách tiếp
    -- nhận MOET thực tế có dòng thiếu SĐT; học viên tự bổ sung sau. DB không
    -- phân biệt được theo nguon_tao ở tầng CHECK constraint đơn giản, nên bỏ
    -- NOT NULL ở đây, ép buộc "bắt buộc cho tu_dang_ky" chuyển hẳn sang tầng
    -- API (CreateHocVienDto vẫn @IsString() bắt buộc, không đổi).
    so_dien_thoai_lien_he   varchar(20),
    email_lien_he           varchar(255),

    -- Trình độ & chuyên môn — không có trong danh sách MOET, bổ sung sau
    trinh_do_chuyen_mon     trinh_do_chuyen_mon,
    trinh_do_chuyen_mon_khac varchar(255),   -- chỉ khi trinh_do_chuyen_mon = 'khac'
    cap_giang_day           cap_hoc,             -- NULL hợp lệ cho nhân sự không trực tiếp giảng dạy
    mon_giang_day_id        uuid REFERENCES mon_hoc(id),

    -- Ghi chú mang theo từ danh sách tiếp nhận (nếu có)
    ghi_chu                 text,

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
    created_by                uuid REFERENCES nguoi_dung(id),
        -- 'tu_dang_ky'  : = tài khoản NguoiDung của chính học viên
        -- 'import_moet' : = tài khoản Quản trị hệ thống đã chạy import

    CONSTRAINT uq_hoc_vien_ddcn UNIQUE (so_dinh_danh_ca_nhan),
    CONSTRAINT uq_hoc_vien_ma_moet UNIQUE (ma_dinh_danh_moet),
    CONSTRAINT chk_hoc_vien_ddcn_12_so
        CHECK (so_dinh_danh_ca_nhan IS NULL OR so_dinh_danh_ca_nhan ~ '^[0-9]{12}$'),
    CONSTRAINT chk_hoc_vien_nguon_tao CHECK (
        (nguon_tao = 'tu_dang_ky' AND so_dinh_danh_ca_nhan IS NOT NULL)
        OR
        -- Sửa 2026-09-29: xác nhận mã định danh CSDL ngành và CCCD KHÔNG
        -- phải lúc nào cũng trùng nhau, và một số trường không cung cấp
        -- được mã định danh CSDL ngành khi báo danh sách — chấp nhận hồ sơ
        -- import_moet chỉ có 1 trong 2 mã, miễn có ít nhất 1 cái để định
        -- danh + dùng làm ten_dang_nhap (xem "Luồng đăng nhập linh hoạt").
        (nguon_tao = 'import_moet' AND (ma_dinh_danh_moet IS NOT NULL OR so_dinh_danh_ca_nhan IS NOT NULL))
    ),
    CONSTRAINT chk_hoc_vien_ngay_sinh CHECK (ngay_sinh BETWEEN 1 AND 31),
    CONSTRAINT chk_hoc_vien_thang_sinh CHECK (thang_sinh BETWEEN 1 AND 12),
    CONSTRAINT chk_hoc_vien_nam_sinh
        CHECK (nam_sinh BETWEEN 1940 AND date_part('year', now())::int - 15),
        -- độ tuổi tối thiểu 15 — xác nhận đúng quy định (2026-09-23)
    CONSTRAINT chk_hoc_vien_ngay_sinh_hop_le
        CHECK (make_date(nam_sinh, thang_sinh, ngay_sinh) IS NOT NULL),
        -- bắt lỗi 31/04, 30/02, 29/02 năm không nhuận, v.v. Postgres tự raise
        -- lỗi khi make_date() nhận ngày không tồn tại; ràng buộc này chủ yếu
        -- để tài liệu hóa ý định — chặn thật sự nên làm ở tầng ứng dụng để
        -- trả thông báo lỗi rõ ràng thay vì lỗi SQL khó hiểu.
    CONSTRAINT chk_hoc_vien_trinh_do_khac
        CHECK ( trinh_do_chuyen_mon IS DISTINCT FROM 'khac'
             OR trinh_do_chuyen_mon_khac IS NOT NULL ),
    CONSTRAINT chk_hoc_vien_duyet_dong_bo
        CHECK ( (trang_thai IN ('da_duyet', 'tu_choi') AND nguoi_duyet_id IS NOT NULL)
             OR (trang_thai NOT IN ('da_duyet', 'tu_choi')) )
);

CREATE INDEX idx_hoc_vien_don_vi ON hoc_vien(don_vi_cong_tac_id);
CREATE INDEX idx_hoc_vien_trang_thai ON hoc_vien(trang_thai);
CREATE INDEX idx_hoc_vien_cap_giang_day ON hoc_vien(cap_giang_day);
CREATE INDEX idx_hoc_vien_phuong_xa ON hoc_vien(phuong_xa_id);
CREATE INDEX idx_hoc_vien_ho_ten_trgm ON hoc_vien USING gin (ho_ten gin_trgm_ops);
CREATE INDEX idx_hoc_vien_ma_moet ON hoc_vien(ma_dinh_danh_moet);

-- Chuyên môn: 1 học viên có thể có NHIỀU chuyên môn (dữ liệu thực tế từ danh
-- sách MOET xác nhận điều này) — tách bảng con thay vì 1 cột varchar đơn.
-- Tự do, có gợi ý autocomplete ở tầng API, KHÔNG FK vào danh mục quản lý
-- (giữ nguyên quyết định trước đó: chấp nhận dữ liệu không đồng nhất).
CREATE TABLE hoc_vien_chuyen_mon (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hoc_vien_id         uuid NOT NULL REFERENCES hoc_vien(id) ON DELETE CASCADE,
    chuyen_mon          varchar(255) NOT NULL,

    CONSTRAINT uq_hoc_vien_chuyen_mon UNIQUE (hoc_vien_id, chuyen_mon)
);

CREATE INDEX idx_hoc_vien_chuyen_mon_hv ON hoc_vien_chuyen_mon(hoc_vien_id);
CREATE INDEX idx_hoc_vien_chuyen_mon_trgm
    ON hoc_vien_chuyen_mon USING gin (chuyen_mon gin_trgm_ops);

ALTER TABLE nguoi_dung
    ADD CONSTRAINT fk_nguoi_dung_hoc_vien
    FOREIGN KEY (hoc_vien_id) REFERENCES hoc_vien(id);


-- =====================================================================
-- PHẦN 2b — ĐỢT XÁC NHẬN & LỊCH SỬ THAY ĐỔI HỒ SƠ (T14, 2026-09-28)
-- =====================================================================
-- khoa_id NULL = áp dụng cho MỌI hồ sơ import_moet (quyết định "rút gọn để
-- kịp P0", mo-rong-nls-an-giang.md mục 3) — gắn khóa cụ thể để dùng sau này
-- nếu cần thu hẹp phạm vi 1 đợt về đúng học viên đã ghi danh khóa đó.
CREATE TABLE dot_xac_nhan (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    khoa_id         uuid REFERENCES khoa_boi_duong(id),
    ten             varchar(255) NOT NULL,
    loai            loai_dot_xac_nhan NOT NULL,
    mo_luc          timestamptz NOT NULL,
    dong_luc        timestamptz NOT NULL,
    created_by      uuid REFERENCES nguoi_dung(id),
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT chk_dot_xac_nhan_thoi_gian CHECK (dong_luc > mo_luc)
);

CREATE INDEX idx_dot_xac_nhan_khoa ON dot_xac_nhan(khoa_id);

-- "Đợt đang mở" của 1 học viên (DotXacNhanService.dotDangMoCuaHocVien) = đợt
-- có mo_luc <= now() < dong_luc VÀ (khoa_id IS NULL HOẶC học viên đã ghi danh
-- khóa đó qua dang_ky_hoc). Các đợt không được chồng thời gian trong CÙNG
-- khoa_id (kể cả cùng NULL) — thực thi ở tầng API (DotXacNhanService.
-- kiemTraChongCheo), không phải CHECK/EXCLUDE constraint (cần so sánh với
-- các dòng khác trong cùng bảng, giống chk_dang_ky_lop_thuoc_khoa).
CREATE TABLE xac_nhan_ho_so (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dot_id              uuid NOT NULL REFERENCES dot_xac_nhan(id) ON DELETE CASCADE,
    hoc_vien_id         uuid NOT NULL REFERENCES hoc_vien(id),
    xac_nhan_luc        timestamptz NOT NULL DEFAULT now(),
    du_lieu             jsonb NOT NULL,          -- bản chụp hồ sơ tại thời điểm xác nhận
    con_hieu_luc        boolean NOT NULL DEFAULT true,
    vo_hieu_luc_luc     timestamptz,

    CONSTRAINT chk_xac_nhan_hieu_luc CHECK (con_hieu_luc OR vo_hieu_luc_luc IS NOT NULL)
);

CREATE INDEX idx_xac_nhan_hv ON xac_nhan_ho_so(hoc_vien_id);
CREATE INDEX idx_xac_nhan_dot ON xac_nhan_ho_so(dot_id);

-- 1 xác nhận CÒN HIỆU LỰC cho mỗi (đợt, học viên) — sửa hồ sơ sau khi đã xác
-- nhận sẽ set con_hieu_luc=false cho dòng cũ TRƯỚC khi tạo dòng mới
-- (DotXacNhanService.huyXacNhanNeuCo/taoXacNhan), nên index này không bao
-- giờ xung đột trong luồng bình thường.
CREATE UNIQUE INDEX uq_xac_nhan_con_hieu_luc ON xac_nhan_ho_so(dot_id, hoc_vien_id) WHERE con_hieu_luc;

-- Mỗi TRƯỜNG thay đổi (không phải mỗi request PATCH) là 1 dòng riêng — 1 lần
-- PATCH sửa 3 trường sinh 3 dòng. la_truong_goc_moet=true cho đúng 7 trường
-- liệt kê trong mo-rong-nls-an-giang.md mục T14 (+ 'chuyen_mon', ghi qua
-- POST/DELETE /hoc-vien/toi/chuyen-mon) — dùng lọc cho GET /bao-cao/sua-truong-moet
-- (N1 rà soát). Giá trị so_dinh_danh_ca_nhan (CCCD) trong lịch sử chỉ Quản
-- trị xem được — không có endpoint nào khác đọc trực tiếp bảng này.
CREATE TABLE lich_su_thay_doi_ho_so (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hoc_vien_id         uuid NOT NULL REFERENCES hoc_vien(id),
    truong              varchar(64) NOT NULL,
    gia_tri_cu          text,
    gia_tri_moi         text,
    la_truong_goc_moet  boolean NOT NULL DEFAULT false,
    nguoi_sua_id        uuid NOT NULL REFERENCES nguoi_dung(id),
    vai_tro_nguoi_sua   vai_tro_nguoi_dung NOT NULL,
    dot_id              uuid REFERENCES dot_xac_nhan(id),
    sua_luc             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lich_su_hv ON lich_su_thay_doi_ho_so(hoc_vien_id);
CREATE INDEX idx_lich_su_goc_moet ON lich_su_thay_doi_ho_so(la_truong_goc_moet) WHERE la_truong_goc_moet;

-- T15 (mo-rong-nls-an-giang.md, 2026-09-28): tài khoản VLE do Phòng CNTT tạo
-- cho TẤT CẢ học viên import_moet (QĐ8, cách B — chặn "mềm": tài khoản luôn
-- tồn tại, hệ thống chỉ ẩn/hiện thông tin ở GET /hoc-vien/toi/danh-gia-dau-vao
-- tùy điều kiện). mat_khau_tam_ma_hoa mã hóa AES-256-GCM ở TẦNG ỨNG DỤNG
-- (vle-crypto.util.ts, khóa trong env VLE_SECRET_KEY) — DB không bao giờ
-- chứa mật khẩu dạng rõ.
CREATE TABLE tai_khoan_vle (
    hoc_vien_id             uuid PRIMARY KEY REFERENCES hoc_vien(id),
    ten_dang_nhap_vle       varchar(100) NOT NULL,
    mat_khau_tam_ma_hoa     bytea,
    duong_dan               varchar(500) NOT NULL,
    lan_dau_xem_luc         timestamptz,
    nguon_import_id         uuid REFERENCES nhat_ky_import(id),
    cap_nhat_luc            timestamptz NOT NULL DEFAULT now()
);


-- =====================================================================
-- PHẦN 3 — KHÓA BỒI DƯỠNG & LỚP HỌC (board MoHinhKhoaHoc.dc.html)
-- =====================================================================

CREATE TABLE khoa_boi_duong (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ma_khoa             varchar(30) NOT NULL,
    ten_khoa            varchar(255) NOT NULL,
    don_vi_dat_hang_id  uuid NOT NULL REFERENCES don_vi_cong_tac(id),  -- đơn vị đặt hàng (Sở/Trường/đơn vị khác); HCMUE luôn tổ chức
    dia_diem            varchar(255),
    thoi_gian_bat_dau   date NOT NULL,
    thoi_gian_ket_thuc  date NOT NULL,
    trang_thai          trang_thai_khoa NOT NULL DEFAULT 'nhap',
    nguoi_duyet_id      uuid REFERENCES nguoi_dung(id),
    cap_duyet_thuc_te   vai_tro_nguoi_dung,
    ngay_duyet          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid REFERENCES nguoi_dung(id),
        -- Thêm 2026-09-28: trước đó không có cột này, nên "Dịch vụ Thông báo"
        -- phải đoán người nhận email khi khóa được duyệt (findFirst tài khoản
        -- truong trong đơn vị — sai nếu 1 Trường có nhiều tài khoản). Nay ghi
        -- rõ đúng tài khoản đã gọi POST /khoa-boi-duong lúc tạo, NULL cho các
        -- khóa tạo trước migration này (dữ liệu cũ không truy ngược được).

    CONSTRAINT uq_khoa_ma UNIQUE (ma_khoa),
    CONSTRAINT chk_khoa_thoi_gian CHECK (thoi_gian_ket_thuc >= thoi_gian_bat_dau)
);

CREATE INDEX idx_khoa_don_vi ON khoa_boi_duong(don_vi_dat_hang_id);
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
    -- T6 (mo-rong-nls-an-giang.md, 2026-09-29, QĐ3/QĐ4): nhóm học viên (1-20,
    -- 3 nhóm gối đầu) và mức năng lực mục tiêu của lớp. Nhập qua import
    -- lop_va_lich_hoc.
    nhom_hoc_vien       smallint,
    muc_nang_luc        muc_nang_luc,

    CONSTRAINT chk_lop_si_so CHECK (si_so_toi_da IS NULL OR si_so_toi_da > 0),
    -- T3 (mo-rong-nls-an-giang.md): tên lớp phải duy nhất trong cùng 1 khóa.
    CONSTRAINT uq_lop_ten_trong_khoa UNIQUE (khoa_id, ten_lop),
    CONSTRAINT chk_lop_hoc_nhom CHECK (nhom_hoc_vien BETWEEN 1 AND 20)
);

CREATE INDEX idx_lop_khoa ON lop_hoc(khoa_id);

-- T10 (issue #2, 2026-10-07): danh mục điểm học trực tiếp. Không xóa cứng
-- (rule #40) — ngưng bằng trang_thai. tao_boi: người tạo (ADR 0004 — người
-- hỗ trợ giảng viên cũng tạo được, Quản trị gộp trùng).
CREATE TABLE diem_hoc (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ma_diem_hoc     varchar(30)  NOT NULL,
    ten             varchar(255) NOT NULL,
    dia_chi         varchar(500) NOT NULL,
    dia_ban_id      uuid NOT NULL REFERENCES dia_danh(id),
    don_vi_id       uuid REFERENCES don_vi_cong_tac(id),   -- trường sở tại (nếu có)
    suc_chua        integer,
    so_phong        smallint,
    nguoi_lien_he   varchar(255),
    sdt_lien_he     varchar(20),
    ghi_chu_csvc    text,
    trang_thai      trang_thai_active NOT NULL DEFAULT 'active',
    tao_boi         uuid REFERENCES nguoi_dung(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_diem_hoc_ma UNIQUE (ma_diem_hoc),
    CONSTRAINT chk_diem_hoc_suc_chua CHECK (suc_chua IS NULL OR suc_chua > 0),
    CONSTRAINT chk_diem_hoc_so_phong CHECK (so_phong IS NULL OR so_phong > 0)
);
CREATE INDEX idx_diem_hoc_dia_ban ON diem_hoc(dia_ban_id);

CREATE TABLE lich_hoc_lop (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lop_id                  uuid NOT NULL REFERENCES lop_hoc(id) ON DELETE CASCADE,
    giai_doan_id            uuid NOT NULL REFERENCES giai_doan_khoa(id) ON DELETE CASCADE,
    -- T6 (mo-rong-nls-an-giang.md, 2026-09-29, QĐ3): 1 lớp có NHIỀU buổi
    -- trong cùng 1 giai đoạn (Zoom nhiều buổi; trực tiếp 3 ngày = 3 buổi).
    buoi_so                 smallint NOT NULL DEFAULT 1,
    thoi_gian_bat_dau       timestamptz NOT NULL,
    thoi_gian_ket_thuc      timestamptz NOT NULL,
    dia_diem_hoac_link      varchar(500),
    trang_thai              trang_thai_lich_hoc NOT NULL DEFAULT 'chua_dien_ra',
    -- T10 (issue #2, 2026-10-07): điểm học (bắt buộc với giai đoạn
    -- hinh_thuc='truc_tiep' — kiểm ở API, rule #119), phòng, và mốc cập nhật
    -- giờ/địa điểm (chỉ đổi khi 1 trong thoi_gian_*/dia_diem_hoac_link/
    -- diem_hoc_id/phong đổi — ADR 0004 "cần nhắc lại").
    diem_hoc_id             uuid REFERENCES diem_hoc(id),
    phong                   varchar(100),
    cap_nhat_luc            timestamptz NOT NULL DEFAULT now(),

    -- T6: thay uq_lich_hoc_lop_giai_doan (1 lịch/giai đoạn/lớp) bằng ràng
    -- buộc có thêm buoi_so.
    CONSTRAINT uq_lich_hoc_lop_giai_doan_buoi UNIQUE (lop_id, giai_doan_id, buoi_so),
    CONSTRAINT chk_lich_hoc_thoi_gian CHECK (thoi_gian_ket_thuc > thoi_gian_bat_dau),
    CONSTRAINT chk_lich_hoc_lop_buoi CHECK (buoi_so >= 1)
);

CREATE INDEX idx_lich_hoc_lop ON lich_hoc_lop(lop_id);
CREATE INDEX idx_lich_hoc_giai_doan ON lich_hoc_lop(giai_doan_id);
CREATE INDEX idx_lich_hoc_diem_hoc ON lich_hoc_lop(diem_hoc_id);

-- T11 (issue #3) + ADR 0004 (2026-10-07): danh mục giảng viên + phân công
-- giảng viên vào từng buổi. lop_hoc_nhan_su (bên dưới) giữ nguyên để tương
-- thích ngược. Enum loai_danh_muc_import += 'giang_vien',
-- 'phan_cong_giang_day' (migration riêng).
CREATE TABLE giang_vien (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ho_ten          varchar(255) NOT NULL,
    email           varchar(255),
    so_dien_thoai   varchar(20)  NOT NULL,
    don_vi_cong_tac varchar(255),
    ghi_chu         text,
    trang_thai      trang_thai_active NOT NULL DEFAULT 'active',
    tao_boi         uuid REFERENCES nguoi_dung(id) ON DELETE SET NULL,
    nguon_import_id uuid REFERENCES nhat_ky_import(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_giang_vien_email UNIQUE (email),
    CONSTRAINT uq_giang_vien_sdt UNIQUE (so_dien_thoai)
);

CREATE TABLE phan_cong_giang_day (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lich_hoc_id         uuid NOT NULL REFERENCES lich_hoc_lop(id) ON DELETE CASCADE,
    giang_vien_id       uuid NOT NULL REFERENCES giang_vien(id),
    vai_tro             vai_tro_nhan_su_lop NOT NULL,
    so_gio              numeric(4,1) CHECK (so_gio IS NULL OR so_gio > 0),
    da_xac_nhan_gio     boolean NOT NULL DEFAULT false,
    xac_nhan_luc        timestamptz,
    nguoi_xac_nhan_id   uuid REFERENCES nguoi_dung(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_phan_cong UNIQUE (lich_hoc_id, giang_vien_id),
    CONSTRAINT chk_phan_cong_xac_nhan CHECK (
        (da_xac_nhan_gio AND xac_nhan_luc IS NOT NULL AND nguoi_xac_nhan_id IS NOT NULL)
        OR NOT da_xac_nhan_gio)
);
CREATE INDEX idx_phan_cong_gv ON phan_cong_giang_day(giang_vien_id);

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
    -- T5 (mo-rong-nls-an-giang.md, 2026-09-29): ghi bằng import ket_qua_danh_gia,
    -- upsert theo (hoc_vien_id, khoa_id) đã tồn tại (phải ghi danh T3 trước).
    muc_dau_vao         muc_nang_luc,
    muc_dau_ra          muc_nang_luc,

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
-- PHẦN 4 — THÔNG BÁO (board Main.dc.html — "Dịch vụ Thông báo")
-- =====================================================================

-- Ghi nhận MỖI lần gửi (kể cả thất bại) cho 1 trong 5 sự kiện ở
-- api-contract.md mục 8. Không có bảng này thì GET /thong-bao/lich-su
-- không có gì để đọc, và không thể tra soát khi học viên báo không nhận
-- được email.
CREATE TABLE nhat_ky_thong_bao (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loai_su_kien        loai_su_kien_thong_bao NOT NULL,
    hoc_vien_id         uuid REFERENCES hoc_vien(id),
    email_nguoi_nhan    varchar(255) NOT NULL,
    tieu_de             varchar(255) NOT NULL,
    gui_luc             timestamptz NOT NULL DEFAULT now(),
    trang_thai          trang_thai_gui_thong_bao NOT NULL,
    loi                 text,   -- thông báo lỗi nếu trang_thai='that_bai'

    CONSTRAINT chk_thong_bao_loi
        CHECK ( (trang_thai = 'that_bai' AND loi IS NOT NULL)
             OR (trang_thai = 'thanh_cong') )
);

CREATE INDEX idx_thong_bao_hoc_vien ON nhat_ky_thong_bao(hoc_vien_id);
CREATE INDEX idx_thong_bao_loai_su_kien ON nhat_ky_thong_bao(loai_su_kien);
CREATE INDEX idx_thong_bao_gui_luc ON nhat_ky_thong_bao(gui_luc);

-- M9 (2026-10-01): hàng đợi gửi email hàng loạt (5 sự kiện làn "hàng loạt" —
-- xem api-contract.md mục 8) — HangDoiEmailProcessor (cron mỗi phút) rút tối
-- đa 20 dòng cho_gui/lượt theo FIFO (created_at tăng dần), giới hạn thêm bởi
-- EMAIL_DAILY_LIMIT/ngày (giờ Việt Nam) để không vượt hạn mức SMTP của
-- Google Workspace. Làn "ưu tiên cao" (email_xac_minh/dat_lai_mat_khau)
-- KHÔNG đi qua bảng này.
CREATE TABLE hang_doi_email (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loai_su_kien        loai_su_kien_thong_bao NOT NULL,
    hoc_vien_id         uuid REFERENCES hoc_vien(id),
    email_nguoi_nhan    varchar(255) NOT NULL,
    tieu_de             varchar(255) NOT NULL,
    noi_dung_html       text NOT NULL,
    trang_thai          trang_thai_hang_doi_email NOT NULL DEFAULT 'cho_gui',
    so_lan_thu          integer NOT NULL DEFAULT 0,
    loi                 text,   -- lỗi lần thử gần nhất
    created_at          timestamptz NOT NULL DEFAULT now(),
    gui_luc             timestamptz   -- chỉ set khi thành công hoặc thất bại hẳn (so_lan_thu >= 3)
);

CREATE INDEX idx_hang_doi_email_trang_thai_created_at ON hang_doi_email(trang_thai, created_at);
CREATE INDEX idx_hang_doi_email_hoc_vien ON hang_doi_email(hoc_vien_id);


-- =====================================================================
-- PHẦN 5 — CẤU HÌNH VẬN HÀNH (2026-10-02, migration 20261002110000)
-- =====================================================================
-- Khóa-giá trị. Hiện có 1 khóa 'khao_sat_dau_vao': chế độ triển khai cho học
-- viên ('khao_sat' | 'dang_nhap') + danh sách phiếu khảo sát ở trang chủ, do
-- quan_tri sửa (PUT /cau-hinh-khao-sat), đọc công khai (GET). Shape gia_tri do
-- DTO tầng ứng dụng kiểm soát — xem docs/api-contract.md mục 9.
CREATE TABLE cau_hinh_he_thong (
    khoa          VARCHAR(100) PRIMARY KEY,
    gia_tri       JSONB NOT NULL,
    cap_nhat_luc  TIMESTAMPTZ NOT NULL DEFAULT now(),
    cap_nhat_boi  UUID            -- nguoi_dung.id, cố ý không FK (bảng cấu hình độc lập)
);


-- =====================================================================
-- PHẦN 6 — SSO SANG HỆ THỐNG KHẢO SÁT (2026-10-02, migration 20261002120000)
-- =====================================================================
-- Mã dùng 1 lần, hết hạn sau 5 phút. CHỈ lưu SHA-256 (hex) của mã — mã gốc
-- chỉ nằm trên URL chuyển hướng. Đổi mã: UPDATE nguyên tử đặt da_dung_luc.
-- Xem docs/api-contract.md mục 10.
CREATE TABLE ma_sso_mot_lan (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ma_hash      char(64) NOT NULL,
    hoc_vien_id  uuid NOT NULL REFERENCES hoc_vien(id) ON DELETE CASCADE,
    target       varchar(20),          -- 'khao-sat' | 'danh-gia' | NULL (danh sách bài)
    het_han      timestamptz NOT NULL,
    da_dung_luc  timestamptz,          -- NULL = chưa đổi
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_ma_sso_hash UNIQUE (ma_hash)
);
CREATE INDEX idx_ma_sso_hoc_vien ON ma_sso_mot_lan(hoc_vien_id);


-- =====================================================================
-- PHẦN 7 — CẤU HÌNH KHẢO SÁT THEO KHÓA (2026-10-02, migration 20261002130000)
-- =====================================================================
-- Ghi đè cấu hình chung (PHẦN 5, khóa 'khao_sat_dau_vao') cho 1 khóa. Shape
-- gia_tri giống cấu hình chung. tinh_id = tỉnh hiển thị ở ô chọn tỉnh trang
-- chủ; mỗi tỉnh gắn tối đa 1 khóa (UNIQUE, NULL được lặp). Xem api-contract mục 9.
CREATE TABLE cau_hinh_khao_sat_khoa (
    khoa_id       uuid PRIMARY KEY REFERENCES khoa_boi_duong(id) ON DELETE CASCADE,
    tinh_id       uuid REFERENCES dia_danh(id),   -- cấp tinh_thanh (kiểm tra ở tầng ứng dụng)
    gia_tri       jsonb NOT NULL,
    cap_nhat_luc  timestamptz NOT NULL DEFAULT now(),
    cap_nhat_boi  uuid,
    CONSTRAINT uq_cau_hinh_khao_sat_khoa_tinh UNIQUE (tinh_id)
);


-- =====================================================================
-- PHẦN 8 — KẾT QUẢ KHẢO SÁT (2026-10-04, migration 20261004110000 + 20261004110100)
-- =====================================================================
-- Tình trạng + kết quả từng bài trên hệ thống khảo sát. "Chưa làm" = không có
-- dòng. da_mo do cổng ghi khi đổi mã SSO; dang_lam/hoan_thanh do hệ thống khảo
-- sát báo (POST /sso/ket-qua) hoặc import 'ket_qua_khao_sat' (giá trị enum
-- loai_danh_muc_import thêm ở migration riêng). KHÔNG tự đổi muc_dau_vao.
-- Xem docs/api-contract.md mục 10.1.
CREATE TYPE trang_thai_khao_sat AS ENUM ('da_mo', 'dang_lam', 'hoan_thanh');

CREATE TABLE ket_qua_khao_sat (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hoc_vien_id      uuid NOT NULL REFERENCES hoc_vien(id) ON DELETE CASCADE,
    loai             varchar(20) NOT NULL,     -- 'khao-sat' | 'danh-gia' | 'dau-ra' (= target SSO)
    trang_thai       trang_thai_khao_sat NOT NULL,
    so_lan_mo        int NOT NULL DEFAULT 0,
    mo_lan_dau_luc   timestamptz,
    mo_gan_nhat_luc  timestamptz,
    bat_dau_luc      timestamptz,
    hoan_thanh_luc   timestamptz,
    muc              muc_nang_luc,
    diem             numeric(6,2),
    diem_toi_da      numeric(6,2),             -- 2026-10-05 (migration 20261005090000)
    muc_goc          varchar(50),              -- mã thang hệ thống khảo sát 'M1'..'M4' (nhãn hiển thị ở FE)
    url_ket_qua      varchar(500),             -- trang kết quả chi tiết, cùng tên miền SSO_KHAO_SAT_URL
    chi_tiet         jsonb,
    nguon            varchar(10) NOT NULL,     -- 'sso' | 'api' | 'import' (nguồn ghi gần nhất)
    cap_nhat_luc     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_ket_qua_khao_sat_hoc_vien_loai UNIQUE (hoc_vien_id, loai)
);
CREATE INDEX idx_ket_qua_khao_sat_loai_trang_thai ON ket_qua_khao_sat(loai, trang_thai);


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
-- 3. "hoc_vien_chuyen_mon.chuyen_mon" cố ý KHÔNG có FK/danh mục — theo quyết
--    định thiết kế: chấp nhận dữ liệu không đồng nhất 100%, gợi ý autocomplete
--    lấy từ SELECT DISTINCT chuyen_mon FROM hoc_vien_chuyen_mon ...
--    (tầng ứng dụng), không chuẩn hóa. Bảng tách riêng (1-nhiều) vì dữ liệu
--    thực tế từ danh sách tiếp nhận CSDL MOET xác nhận 1 người có thể có
--    nhiều chuyên môn cùng lúc.
--
-- 4. Chuẩn hóa NFC: thực hiện ở tầng ứng dụng (Node.js: String.prototype.
--    normalize('NFC')) trước khi INSERT/UPDATE các cột: ho_ten, ten,
--    ten_don_vi, ten_mon, ten_khoa, ten_lop, ten_giai_doan, chuyen_mon. Không
--    thực thi được bằng CHECK constraint thuần Postgres.
--
-- 5. Hồ sơ tạo từ import_moet (nguon_tao='import_moet') CỐ Ý thiếu nhiều
--    trường (so_dinh_danh_ca_nhan, noi_sinh_id, phuong_xa_id, email_lien_he,
--    trinh_do_chuyen_mon, cap_giang_day, mon_giang_day_id đều NULL lúc tạo).
--    trang_thai vẫn set thẳng 'da_duyet' (danh sách tiếp nhận coi như đã xác
--    thực) — KHÔNG đồng nghĩa hồ sơ đã đầy đủ. Tầng API chịu trách nhiệm:
--      a) không cho hồ sơ import_moet đăng ký khóa bồi dưỡng cho tới khi các
--         trường bắt buộc-có-điều-kiện đã được người dùng tự bổ sung;
--      b) validate lại đầy đủ (cùng bộ quy tắc như tu_dang_ky) tại thời điểm
--         người dùng bổ sung, không phải lúc import.
--    Đã chốt (2026-09-23): cap_giang_day/mon_giang_day_id là TÙY CHỌN cho
--    mọi hồ sơ, vĩnh viễn — không chỉ tạm thời chờ bổ sung. Nhân viên không
--    trực tiếp giảng dạy (chuc_vu='Nhân viên'...) được phép để trống 2
--    trường này mãi mãi. Khi cap_giang_day = NULL, routing duyệt mặc định
--    về Sở GD&ĐT thay vì chặn — xem docs/api-contract.md mục "Routing đơn
--    vị duyệt".
-- =====================================================================

-- ADR 0004 L1/L3 (issue #14, #16, 2026-10-07): người hỗ trợ giảng viên.
-- Enum vai_tro_nguoi_dung += 'ho_tro_giang_vien' (migration riêng);
-- chk_nguoi_dung_scope/chk_nguoi_dung_email_bat_buoc thêm nhánh này.
CREATE TABLE phan_cong_ho_tro_gv (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nguoi_dung_id uuid NOT NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE,
    khoa_id       uuid NOT NULL REFERENCES khoa_boi_duong(id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_phan_cong_ho_tro_gv UNIQUE (nguoi_dung_id, khoa_id)
);
CREATE INDEX idx_phan_cong_ho_tro_gv_khoa ON phan_cong_ho_tro_gv(khoa_id);

CREATE TABLE hau_can_giang_vien (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lop_id                uuid NOT NULL REFERENCES lop_hoc(id) ON DELETE CASCADE,
    giai_doan_id          uuid NOT NULL REFERENCES giai_doan_khoa(id) ON DELETE CASCADE,
    giang_vien_id         uuid NOT NULL REFERENCES giang_vien(id) ON DELETE CASCADE,
    noi_o_ten             varchar(255),
    noi_o_dia_chi         varchar(500),
    nhan_phong            date,
    tra_phong             date,
    phuong_tien           varchar(255),
    don_luc               timestamptz,
    diem_don              varchar(500),
    lien_he_don           varchar(255),
    ghi_chu               text,
    da_xac_nhan_noi_o     boolean NOT NULL DEFAULT false,
    da_xac_nhan_di_chuyen boolean NOT NULL DEFAULT false,
    cap_nhat_boi          uuid REFERENCES nguoi_dung(id) ON DELETE SET NULL,
    cap_nhat_luc          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_hau_can_gv UNIQUE (lop_id, giai_doan_id, giang_vien_id),
    CONSTRAINT chk_hau_can_ngay CHECK (tra_phong IS NULL OR nhan_phong IS NULL OR tra_phong >= nhan_phong)
);

CREATE TABLE nhan_su_thuc_dia (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lop_id        uuid NOT NULL REFERENCES lop_hoc(id) ON DELETE CASCADE,
    giai_doan_id  uuid NOT NULL REFERENCES giai_doan_khoa(id) ON DELETE CASCADE,
    ho_ten        varchar(255) NOT NULL,
    so_dien_thoai varchar(20) NOT NULL,
    nhiem_vu      varchar(255),
    ghi_chu       text,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_thuc_dia_dot ON nhan_su_thuc_dia(lop_id, giai_doan_id);

-- ADR 0004 L4 (issue #17, 2026-10-07): bảng kiểm chuẩn bị đợt trực tiếp.
CREATE TYPE loai_muc_kiem_tra AS ENUM ('tu_dong', 'thu_cong');
CREATE TABLE muc_kiem_tra (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    khoa_id        uuid REFERENCES khoa_boi_duong(id) ON DELETE CASCADE,  -- NULL = bộ mặc định
    thu_tu         integer NOT NULL,
    ten            varchar(255) NOT NULL,
    mo_ta          text,
    loai           loai_muc_kiem_tra NOT NULL,
    ma_quy_tac     varchar(50),
    han_truoc_ngay smallint,
    trang_thai     trang_thai_active NOT NULL DEFAULT 'active',
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_muc_kiem_tra_quy_tac CHECK ((loai = 'tu_dong') = (ma_quy_tac IS NOT NULL)),
    CONSTRAINT chk_muc_kiem_tra_han CHECK (han_truoc_ngay IS NULL OR han_truoc_ngay >= 0)
);
CREATE INDEX idx_muc_kiem_tra_khoa ON muc_kiem_tra(khoa_id);
CREATE TABLE trang_thai_muc_kiem_tra (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    muc_id       uuid NOT NULL REFERENCES muc_kiem_tra(id) ON DELETE CASCADE,
    lop_id       uuid NOT NULL REFERENCES lop_hoc(id) ON DELETE CASCADE,
    giai_doan_id uuid NOT NULL REFERENCES giai_doan_khoa(id) ON DELETE CASCADE,
    da_xong      boolean NOT NULL DEFAULT false,
    ghi_chu      text,
    cap_nhat_boi uuid REFERENCES nguoi_dung(id) ON DELETE SET NULL,
    cap_nhat_luc timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_trang_thai_muc_kiem_tra UNIQUE (muc_id, lop_id, giai_doan_id)
);

-- ADR 0004 L5 (issue #18, 2026-10-07): báo vắng + đề nghị đổi lớp.
CREATE TYPE trang_thai_de_nghi AS ENUM ('cho_duyet', 'da_duyet', 'tu_choi', 'da_huy');
CREATE TABLE bao_vang (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dang_ky_hoc_id uuid NOT NULL REFERENCES dang_ky_hoc(id) ON DELETE CASCADE,
    lich_hoc_id    uuid NOT NULL REFERENCES lich_hoc_lop(id) ON DELETE CASCADE,
    ly_do          text NOT NULL CHECK (length(btrim(ly_do)) > 0),
    nguoi_ghi      uuid REFERENCES nguoi_dung(id) ON DELETE SET NULL,
    ghi_luc        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_bao_vang UNIQUE (dang_ky_hoc_id, lich_hoc_id)
);
CREATE TABLE de_nghi_doi_lop (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dang_ky_hoc_id  uuid NOT NULL REFERENCES dang_ky_hoc(id) ON DELETE CASCADE,
    giai_doan_id    uuid NOT NULL REFERENCES giai_doan_khoa(id) ON DELETE CASCADE,
    lop_hien_tai_id uuid REFERENCES lop_hoc(id) ON DELETE CASCADE,
    lop_de_nghi_id  uuid NOT NULL REFERENCES lop_hoc(id) ON DELETE CASCADE,
    ly_do           text NOT NULL CHECK (length(btrim(ly_do)) > 0),
    trang_thai      trang_thai_de_nghi NOT NULL DEFAULT 'cho_duyet',
    nguoi_tao       uuid REFERENCES nguoi_dung(id) ON DELETE SET NULL,
    tao_luc         timestamptz NOT NULL DEFAULT now(),
    nguoi_xu_ly     uuid REFERENCES nguoi_dung(id) ON DELETE SET NULL,
    xu_ly_luc       timestamptz,
    ghi_chu_xu_ly   text,
    CONSTRAINT chk_de_nghi_khac_lop CHECK (lop_hien_tai_id IS NULL OR lop_hien_tai_id <> lop_de_nghi_id)
);
CREATE UNIQUE INDEX uq_de_nghi_doi_lop_cho ON de_nghi_doi_lop(dang_ky_hoc_id, giai_doan_id) WHERE trang_thai = 'cho_duyet';
