-- ADR 0015 X2 (issue #62): Đề nghị sửa/thêm/bớt người của trường — HCMUE Áp dụng / Từ chối.
-- Chỉ thêm (2 enum, 1 bảng, FK, CHECK, index) — không sửa bảng cũ, không backfill, không đổi dữ liệu.

-- CreateEnum
CREATE TYPE "loai_de_nghi_sua" AS ENUM ('sua', 'them', 'bot');

-- CreateEnum
CREATE TYPE "trang_thai_de_nghi_sua" AS ENUM ('cho', 'da_ap_dung', 'tu_choi');

-- CreateTable
CREATE TABLE "de_nghi_sua_danh_sach" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dot_trien_khai_id" UUID NOT NULL,
    "don_vi_id" UUID NOT NULL,
    "dong_id" UUID,
    "loai" "loai_de_nghi_sua" NOT NULL,
    "gia_tri" JSONB NOT NULL DEFAULT '{}',
    "gia_tri_cu" JSONB,
    "ly_do" TEXT,
    "trang_thai" "trang_thai_de_nghi_sua" NOT NULL DEFAULT 'cho',
    "ly_do_tu_choi" TEXT,
    "gui_boi" UUID NOT NULL,
    "gui_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "xu_ly_boi" UUID,
    "xu_ly_luc" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "de_nghi_sua_danh_sach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_de_nghi_sua_dot_don_vi_trang_thai" ON "de_nghi_sua_danh_sach"("dot_trien_khai_id", "don_vi_id", "trang_thai");

-- CreateIndex (FK ON DELETE SET NULL khi xóa/nạp lại dòng danh sách tìm theo dong_id)
CREATE INDEX "idx_de_nghi_sua_dong" ON "de_nghi_sua_danh_sach"("dong_id");

-- AddForeignKey
ALTER TABLE "de_nghi_sua_danh_sach" ADD CONSTRAINT "de_nghi_sua_danh_sach_dot_trien_khai_id_fkey" FOREIGN KEY ("dot_trien_khai_id") REFERENCES "dot_trien_khai"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "de_nghi_sua_danh_sach" ADD CONSTRAINT "de_nghi_sua_danh_sach_don_vi_id_fkey" FOREIGN KEY ("don_vi_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey (xóa dòng danh sách → đề nghị giữ lại, dong_id = NULL; gia_tri_cu vẫn còn bản chụp)
ALTER TABLE "de_nghi_sua_danh_sach" ADD CONSTRAINT "de_nghi_sua_danh_sach_dong_id_fkey" FOREIGN KEY ("dong_id") REFERENCES "danh_sach_tham_gia"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "de_nghi_sua_danh_sach" ADD CONSTRAINT "de_nghi_sua_danh_sach_gui_boi_fkey" FOREIGN KEY ("gui_boi") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "de_nghi_sua_danh_sach" ADD CONSTRAINT "de_nghi_sua_danh_sach_xu_ly_boi_fkey" FOREIGN KEY ("xu_ly_boi") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Raw SQL bổ sung (không biểu diễn được bằng Prisma DSL).
-- Đề nghị thêm người không gắn dòng.
ALTER TABLE "de_nghi_sua_danh_sach" ADD CONSTRAINT "chk_de_nghi_sua_them_khong_dong" CHECK ("loai" <> 'them' OR "dong_id" IS NULL);
-- Từ chối bắt buộc lý do.
ALTER TABLE "de_nghi_sua_danh_sach" ADD CONSTRAINT "chk_de_nghi_sua_tu_choi_ly_do" CHECK ("trang_thai" <> 'tu_choi' OR ("ly_do_tu_choi" IS NOT NULL AND btrim("ly_do_tu_choi") <> ''));
-- Đã xử lý thì có người + lúc xử lý.
ALTER TABLE "de_nghi_sua_danh_sach" ADD CONSTRAINT "chk_de_nghi_sua_da_xu_ly" CHECK ("trang_thai" = 'cho' OR ("xu_ly_boi" IS NOT NULL AND "xu_ly_luc" IS NOT NULL));
-- Mỗi dòng chỉ có 1 đề nghị đang chờ.
CREATE UNIQUE INDEX "uq_de_nghi_cho_theo_dong" ON "de_nghi_sua_danh_sach"("dong_id") WHERE "trang_thai" = 'cho' AND "dong_id" IS NOT NULL;
