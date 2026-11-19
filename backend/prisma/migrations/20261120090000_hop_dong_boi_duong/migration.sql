-- ADR 0015 M5/X1 (issue #60): Hợp đồng bồi dưỡng — 1 dòng cho mỗi (đợt, trường) có danh sách tham gia.
-- Chỉ thêm (2 enum, 1 bảng, UNIQUE, index, FK) + backfill từ danh_sach_tham_gia — không sửa/xóa dữ liệu cũ.
-- Cột Phần 3–4, bản chụp hồ sơ, hạn riêng… thêm ở các lát sau.

-- CreateEnum
CREATE TYPE "trang_thai_danh_sach_truong" AS ENUM ('cho_xac_nhan', 'da_xac_nhan', 'bao_sai_lech');

-- CreateEnum
CREATE TYPE "trang_thai_hop_dong" AS ENUM ('chua_nop', 'da_nop');

-- CreateTable
CREATE TABLE "hop_dong_boi_duong" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dot_trien_khai_id" UUID NOT NULL,
    "don_vi_id" UUID NOT NULL,
    "trang_thai_danh_sach" "trang_thai_danh_sach_truong" NOT NULL DEFAULT 'cho_xac_nhan',
    "trang_thai_hop_dong" "trang_thai_hop_dong" NOT NULL DEFAULT 'chua_nop',
    "thao_tac_cuoi_boi" UUID,
    "thao_tac_cuoi_luc" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hop_dong_boi_duong_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_hop_dong_dot_don_vi" ON "hop_dong_boi_duong"("dot_trien_khai_id", "don_vi_id");

-- CreateIndex
CREATE INDEX "idx_hop_dong_don_vi" ON "hop_dong_boi_duong"("don_vi_id");

-- AddForeignKey
ALTER TABLE "hop_dong_boi_duong" ADD CONSTRAINT "hop_dong_boi_duong_dot_trien_khai_id_fkey" FOREIGN KEY ("dot_trien_khai_id") REFERENCES "dot_trien_khai"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hop_dong_boi_duong" ADD CONSTRAINT "hop_dong_boi_duong_don_vi_id_fkey" FOREIGN KEY ("don_vi_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hop_dong_boi_duong" ADD CONSTRAINT "hop_dong_boi_duong_thao_tac_cuoi_boi_fkey" FOREIGN KEY ("thao_tac_cuoi_boi") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Backfill: mọi (đợt, trường) đã có ≥ 1 dòng danh sách tham gia có 1 dòng hợp đồng (trạng thái mặc định).
INSERT INTO "hop_dong_boi_duong" ("dot_trien_khai_id", "don_vi_id")
SELECT DISTINCT "dot_trien_khai_id", "don_vi_id" FROM "danh_sach_tham_gia"
ON CONFLICT DO NOTHING;
