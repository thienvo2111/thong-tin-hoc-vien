-- Prisma tự sinh 4 câu "DROP INDEX" ở đây cho các GIN trgm index (tạo bằng
-- raw SQL, ngoài schema.prisma DSL) — ĐÃ GỠ BỎ, xem gotcha đã biết ở
-- migration 20260928065926_t14_loai_dot_xac_nhan_enum.

-- CreateTable
CREATE TABLE "khoa_don_vi_theo_doi" (
    "khoa_id" UUID NOT NULL,
    "don_vi_id" UUID NOT NULL,

    CONSTRAINT "khoa_don_vi_theo_doi_pkey" PRIMARY KEY ("khoa_id","don_vi_id")
);

-- CreateIndex
CREATE INDEX "idx_khoa_theo_doi_don_vi" ON "khoa_don_vi_theo_doi"("don_vi_id");

-- AddForeignKey
ALTER TABLE "khoa_don_vi_theo_doi" ADD CONSTRAINT "khoa_don_vi_theo_doi_khoa_id_fkey" FOREIGN KEY ("khoa_id") REFERENCES "khoa_boi_duong"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "khoa_don_vi_theo_doi" ADD CONSTRAINT "khoa_don_vi_theo_doi_don_vi_id_fkey" FOREIGN KEY ("don_vi_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
