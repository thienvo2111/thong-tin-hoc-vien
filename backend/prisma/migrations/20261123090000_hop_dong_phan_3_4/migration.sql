-- ADR 0015 M5, S5, S6, X4, X5 (issue #64): hợp đồng — Phần 3 (người nhận bản giấy), Phần 4 (QĐ chỉ định thầu),
-- cờ điểm học trực tiếp, thời điểm/người nộp, bản chụp Hồ sơ đơn vị + số liệu lúc nộp.
-- Chỉ thêm cột (NULL được hoặc có DEFAULT) + FK + CHECK — không sửa cột cũ, không backfill, không đổi dữ liệu:
-- mọi dòng cũ đang chua_nop nên CHECK nộp thỏa ngay.

-- AlterTable
ALTER TABLE "hop_dong_boi_duong"
    -- Phần 3: người nhận bản giấy hợp đồng
    ADD COLUMN "nguoi_nhan" TEXT,
    ADD COLUMN "sdt_nguoi_nhan" TEXT,
    ADD COLUMN "dia_chi_nhan" TEXT,
    ADD COLUMN "ghi_chu" TEXT,
    -- Phần 4: QĐ chỉ định thầu (bắt buộc khi giá trị ≥ 50.000.000 đ)
    ADD COLUMN "so_qd" TEXT,
    ADD COLUMN "ngay_qd" DATE,
    ADD COLUMN "diem_hoc_truc_tiep" BOOLEAN NOT NULL DEFAULT false,
    -- Nộp hợp đồng
    ADD COLUMN "nop_luc" TIMESTAMPTZ(6),
    ADD COLUMN "nop_boi" UUID,
    -- Bản chụp lúc nộp (M5) — không tính lại sau khi nộp
    ADD COLUMN "ban_chup_ho_so" JSONB,
    ADD COLUMN "so_nguoi_luc_nop" INTEGER,
    ADD COLUMN "tong_suat_luc_nop" DECIMAL(10,1),
    ADD COLUMN "don_gia_luc_nop" INTEGER,
    ADD COLUMN "gia_tri_luc_nop" BIGINT;

-- AddForeignKey
ALTER TABLE "hop_dong_boi_duong" ADD CONSTRAINT "hop_dong_boi_duong_nop_boi_fkey" FOREIGN KEY ("nop_boi") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Raw SQL bổ sung (không biểu diễn được bằng Prisma DSL). Phòng thủ nhiều lớp — ứng dụng đã kiểm tra trước.
-- SĐT người nhận 10 số bắt đầu bằng 0 (NULL được).
ALTER TABLE "hop_dong_boi_duong" ADD CONSTRAINT "chk_hop_dong_sdt_nguoi_nhan" CHECK ("sdt_nguoi_nhan" ~ '^0[0-9]{9}$');
-- Đã nộp thì phải có thời điểm, người nộp, bản chụp hồ sơ và giá trị lúc nộp.
ALTER TABLE "hop_dong_boi_duong" ADD CONSTRAINT "chk_hop_dong_da_nop_co_ban_chup" CHECK (
    "trang_thai_hop_dong" <> 'da_nop'
    OR ("nop_luc" IS NOT NULL AND "nop_boi" IS NOT NULL AND "ban_chup_ho_so" IS NOT NULL AND "gia_tri_luc_nop" IS NOT NULL)
);
