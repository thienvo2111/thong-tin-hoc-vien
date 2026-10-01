-- M9 (2026-10-01, hàng đợi email): migration B — bảng hang_doi_email (hàng
-- đợi gửi email hàng loạt) + enum trang_thai_hang_doi_email (enum MỚI hoàn
-- toàn, không bị ràng buộc "ALTER TYPE khác transaction" nên tạo được trong
-- cùng migration với bảng dùng nó). Chạy SAU migration A (ALTER TYPE
-- loai_su_kien_thong_bao ADD VALUE) — cột loai_su_kien ở bảng này chỉ tham
-- chiếu TYPE, không dùng trực tiếp 2 giá trị mới trong DML nên về mặt kỹ
-- thuật không bắt buộc tách migration, nhưng giữ đúng cấu trúc "migration
-- A/B" đã nhất quán trong toàn bộ migrations/ (xem comment đầu schema.prisma).

-- CreateEnum
CREATE TYPE "trang_thai_hang_doi_email" AS ENUM ('cho_gui', 'thanh_cong', 'that_bai');

-- CreateTable
CREATE TABLE "hang_doi_email" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "loai_su_kien" "loai_su_kien_thong_bao" NOT NULL,
    "hoc_vien_id" UUID,
    "email_nguoi_nhan" VARCHAR(255) NOT NULL,
    "tieu_de" VARCHAR(255) NOT NULL,
    "noi_dung_html" TEXT NOT NULL,
    "trang_thai" "trang_thai_hang_doi_email" NOT NULL DEFAULT 'cho_gui',
    "so_lan_thu" INTEGER NOT NULL DEFAULT 0,
    "loi" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gui_luc" TIMESTAMPTZ(6),

    CONSTRAINT "hang_doi_email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_hang_doi_email_trang_thai_created_at" ON "hang_doi_email"("trang_thai", "created_at");

-- CreateIndex
CREATE INDEX "idx_hang_doi_email_hoc_vien" ON "hang_doi_email"("hoc_vien_id");

-- AddForeignKey
ALTER TABLE "hang_doi_email" ADD CONSTRAINT "hang_doi_email_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
