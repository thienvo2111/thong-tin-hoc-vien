-- ADR 0015 M4 (issue #63): Hồ sơ đơn vị — 1–1 với don_vi_cong_tac, dùng chung mọi đợt (không khóa theo hạn, T2).
-- Chỉ thêm (1 bảng, FK, CHECK) — không sửa bảng cũ, không backfill, không đổi dữ liệu.
-- Mọi cột nội dung NULL được: trường lưu nháp từng phần (X4). KHÔNG có cột STK chuyển khoản (U2: suy ra từ mã QHNS).

-- CreateTable
CREATE TABLE "ho_so_don_vi" (
    "don_vi_id" UUID NOT NULL,
    -- Phần 1: thông tin đơn vị
    "ten_truong" TEXT,
    "dia_chi" TEXT,
    "ma_so_thue" TEXT,
    "nguoi_dai_dien" TEXT,
    "sdt_dai_dien" TEXT,
    "email_hoa_don" TEXT,
    -- Phần 2: thông tin thanh toán
    "so_tai_khoan" TEXT,
    "ngan_hang" TEXT,
    "chi_nhanh" TEXT,
    "kho_bac" TEXT,
    "mst_kho_bac" TEXT,
    "ma_qhns" TEXT,
    "ma_nguon" TEXT,
    -- Phần 5: Hiệu trưởng và kế toán (nhận kinh phí hỗ trợ)
    "ht_ho_ten" TEXT,
    "ht_so_tai_khoan" TEXT,
    "ht_ngan_hang" TEXT,
    "kt_ho_ten" TEXT,
    "kt_sdt" TEXT,
    "kt_so_tai_khoan" TEXT,
    "kt_ngan_hang" TEXT,
    -- Hậu cần cơ sở vật chất (khi trường là điểm học trực tiếp)
    "dau_moi_csvc" TEXT,
    "muc_dap_ung_csvc" TEXT,
    "luu_tru" TEXT,
    "di_chuyen" TEXT,
    "cap_nhat_boi" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ho_so_don_vi_pkey" PRIMARY KEY ("don_vi_id")
);

-- AddForeignKey
ALTER TABLE "ho_so_don_vi" ADD CONSTRAINT "ho_so_don_vi_don_vi_id_fkey" FOREIGN KEY ("don_vi_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ho_so_don_vi" ADD CONSTRAINT "ho_so_don_vi_cap_nhat_boi_fkey" FOREIGN KEY ("cap_nhat_boi") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Raw SQL bổ sung (không biểu diễn được bằng Prisma DSL). Phòng thủ nhiều lớp — ứng dụng đã kiểm tra trước; NULL được.
-- Mã QHNS đúng 7 chữ số.
ALTER TABLE "ho_so_don_vi" ADD CONSTRAINT "chk_ho_so_don_vi_ma_qhns" CHECK ("ma_qhns" ~ '^[0-9]{7}$');
-- MST 10 số hoặc dạng 0123456789-001.
ALTER TABLE "ho_so_don_vi" ADD CONSTRAINT "chk_ho_so_don_vi_ma_so_thue" CHECK ("ma_so_thue" ~ '^[0-9]{10}(-[0-9]{3})?$');
ALTER TABLE "ho_so_don_vi" ADD CONSTRAINT "chk_ho_so_don_vi_mst_kho_bac" CHECK ("mst_kho_bac" ~ '^[0-9]{10}(-[0-9]{3})?$');
-- SĐT 10 số bắt đầu bằng 0.
ALTER TABLE "ho_so_don_vi" ADD CONSTRAINT "chk_ho_so_don_vi_sdt_dai_dien" CHECK ("sdt_dai_dien" ~ '^0[0-9]{9}$');
ALTER TABLE "ho_so_don_vi" ADD CONSTRAINT "chk_ho_so_don_vi_kt_sdt" CHECK ("kt_sdt" ~ '^0[0-9]{9}$');
