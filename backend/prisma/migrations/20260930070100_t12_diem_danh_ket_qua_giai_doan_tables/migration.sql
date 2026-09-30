-- T12 (mo-rong-nls-an-giang.md, 2026-09-30): migration B — bảng diem_danh +
-- ket_qua_giai_doan. Chạy SAU migration A (20260930070000_t12_diem_danh_enum).
--
-- File viết tay theo cùng cách "migrate diff thủ công" đã dùng ở các
-- migration trước (môi trường không tương tác nên không dùng được
-- `migrate dev --create-only` trực tiếp) — không có GIN trgm index nào bị
-- ảnh hưởng nên không có gotcha "DROP INDEX" thừa như các migration khác.
--
-- Unique constraint dùng CREATE UNIQUE INDEX (không phải ADD CONSTRAINT ...
-- UNIQUE) — đúng với cách Prisma sinh SQL cho @@unique(map: "...") trong
-- schema hiện tại (xem các migration trước, vd uq_lop_ten_trong_khoa,
-- uq_cum_ten_trong_khoa) — SQL mẫu trong mo-rong-nls-an-giang.md dùng
-- "CONSTRAINT ... UNIQUE" nhưng đã đổi cho khớp convention Prisma hiện có.

-- CreateTable
CREATE TABLE "diem_danh" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dang_ky_hoc_id" UUID NOT NULL,
    "lich_hoc_id" UUID NOT NULL,
    "trang_thai" "trang_thai_diem_danh" NOT NULL,
    "nguon" "nguon_diem_danh" NOT NULL,
    "ghi_chu" TEXT,
    "nguon_import_id" UUID,
    "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diem_danh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ket_qua_giai_doan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dang_ky_hoc_id" UUID NOT NULL,
    "giai_doan_id" UUID NOT NULL,
    "ty_le_hoan_thanh" DECIMAL(5,2),
    "diem" DECIMAL(5,2),
    "ghi_chu" TEXT,
    "nguon_import_id" UUID,
    "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ket_qua_giai_doan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_diem_danh" ON "diem_danh"("dang_ky_hoc_id", "lich_hoc_id");

-- CreateIndex
CREATE INDEX "idx_diem_danh_lich_hoc" ON "diem_danh"("lich_hoc_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ket_qua_giai_doan" ON "ket_qua_giai_doan"("dang_ky_hoc_id", "giai_doan_id");

-- CreateIndex
CREATE INDEX "idx_ket_qua_giai_doan_giai_doan" ON "ket_qua_giai_doan"("giai_doan_id");

-- AddForeignKey
ALTER TABLE "diem_danh" ADD CONSTRAINT "diem_danh_dang_ky_hoc_id_fkey" FOREIGN KEY ("dang_ky_hoc_id") REFERENCES "dang_ky_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diem_danh" ADD CONSTRAINT "diem_danh_lich_hoc_id_fkey" FOREIGN KEY ("lich_hoc_id") REFERENCES "lich_hoc_lop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diem_danh" ADD CONSTRAINT "diem_danh_nguon_import_id_fkey" FOREIGN KEY ("nguon_import_id") REFERENCES "nhat_ky_import"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ket_qua_giai_doan" ADD CONSTRAINT "ket_qua_giai_doan_dang_ky_hoc_id_fkey" FOREIGN KEY ("dang_ky_hoc_id") REFERENCES "dang_ky_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ket_qua_giai_doan" ADD CONSTRAINT "ket_qua_giai_doan_giai_doan_id_fkey" FOREIGN KEY ("giai_doan_id") REFERENCES "giai_doan_khoa"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ket_qua_giai_doan" ADD CONSTRAINT "ket_qua_giai_doan_nguon_import_id_fkey" FOREIGN KEY ("nguon_import_id") REFERENCES "nhat_ky_import"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Raw SQL bổ sung — CHECK constraint không biểu diễn được bằng Prisma DSL
-- (xem comment đầu prisma/schema.prisma).
ALTER TABLE "ket_qua_giai_doan" ADD CONSTRAINT "chk_ket_qua_giai_doan_ty_le"
    CHECK (ty_le_hoan_thanh BETWEEN 0 AND 100);
