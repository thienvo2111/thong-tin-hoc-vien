-- ADR 0004 G5b (issue #17, 2026-10-07): bảng kiểm chuẩn bị đợt trực tiếp,
-- động theo khóa. khoa_id NULL = bộ mặc định hệ thống; khóa "tùy chỉnh" =
-- sao chép bộ mặc định thành mục của khóa. Mục tự động: ma_quy_tac thuộc danh
-- mục quy tắc trong code (tính động, không lưu kết quả); mục thủ công: người
-- hỗ trợ GV đánh dấu (trang_thai_muc_kiem_tra).
CREATE TYPE "loai_muc_kiem_tra" AS ENUM ('tu_dong', 'thu_cong');

CREATE TABLE "muc_kiem_tra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "khoa_id" UUID,
    "thu_tu" INTEGER NOT NULL,
    "ten" VARCHAR(255) NOT NULL,
    "mo_ta" TEXT,
    "loai" "loai_muc_kiem_tra" NOT NULL,
    "ma_quy_tac" VARCHAR(50),
    "han_truoc_ngay" SMALLINT,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "muc_kiem_tra_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_muc_kiem_tra_quy_tac" CHECK (("loai" = 'tu_dong') = ("ma_quy_tac" IS NOT NULL)),
    CONSTRAINT "chk_muc_kiem_tra_han" CHECK ("han_truoc_ngay" IS NULL OR "han_truoc_ngay" >= 0)
);
CREATE INDEX "idx_muc_kiem_tra_khoa" ON "muc_kiem_tra"("khoa_id");
ALTER TABLE "muc_kiem_tra" ADD CONSTRAINT "muc_kiem_tra_khoa_id_fkey"
    FOREIGN KEY ("khoa_id") REFERENCES "khoa_boi_duong"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "trang_thai_muc_kiem_tra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "muc_id" UUID NOT NULL,
    "lop_id" UUID NOT NULL,
    "giai_doan_id" UUID NOT NULL,
    "da_xong" BOOLEAN NOT NULL DEFAULT false,
    "ghi_chu" TEXT,
    "cap_nhat_boi" UUID,
    "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trang_thai_muc_kiem_tra_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_trang_thai_muc_kiem_tra" ON "trang_thai_muc_kiem_tra"("muc_id", "lop_id", "giai_doan_id");
ALTER TABLE "trang_thai_muc_kiem_tra" ADD CONSTRAINT "trang_thai_muc_kiem_tra_muc_id_fkey"
    FOREIGN KEY ("muc_id") REFERENCES "muc_kiem_tra"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "trang_thai_muc_kiem_tra" ADD CONSTRAINT "trang_thai_muc_kiem_tra_lop_id_fkey"
    FOREIGN KEY ("lop_id") REFERENCES "lop_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "trang_thai_muc_kiem_tra" ADD CONSTRAINT "trang_thai_muc_kiem_tra_giai_doan_id_fkey"
    FOREIGN KEY ("giai_doan_id") REFERENCES "giai_doan_khoa"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "trang_thai_muc_kiem_tra" ADD CONSTRAINT "trang_thai_muc_kiem_tra_cap_nhat_boi_fkey"
    FOREIGN KEY ("cap_nhat_boi") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Bộ mặc định ban đầu: 7 quy tắc tự động + 1 mục thủ công gợi ý.
INSERT INTO "muc_kiem_tra" ("khoa_id", "thu_tu", "ten", "loai", "ma_quy_tac", "han_truoc_ngay") VALUES
    (NULL, 1, 'Mọi buổi đã có điểm học', 'tu_dong', 'co_diem_hoc', 14),
    (NULL, 2, 'Mọi buổi đã phân công giảng viên', 'tu_dong', 'co_giang_vien', 14),
    (NULL, 3, 'Không vượt số phòng của điểm học', 'tu_dong', 'khong_vuot_so_phong', 7),
    (NULL, 4, 'Có học viên, không vượt sĩ số', 'tu_dong', 'co_hoc_vien', 7),
    (NULL, 5, 'Giảng viên có email (để cấp tài khoản, nhận thông tin)', 'tu_dong', 'giang_vien_co_tai_khoan', 7),
    (NULL, 6, 'Đã xác nhận chỗ ở và phương tiện của giảng viên', 'tu_dong', 'hau_can_da_xac_nhan', 3),
    (NULL, 7, 'Có người hỗ trợ thực địa', 'tu_dong', 'co_thuc_dia', 3),
    (NULL, 8, 'Đã gửi danh sách điểm danh cho giảng viên', 'thu_cong', NULL, 1);
