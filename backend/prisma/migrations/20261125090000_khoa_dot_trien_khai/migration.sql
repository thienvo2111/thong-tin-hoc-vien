-- ADR 0015 M1, M3 (issue #68): gắn khóa NLS vào đợt triển khai — 1 đợt nhiều khóa, 1 khóa tối đa 1 đợt.
-- Chỉ thêm 1 cột NULL được + FK + index — không backfill, không đổi dữ liệu.
-- Danh sách tham gia NLS là bản chụp (không đọc sống), nên gỡ khóa khỏi đợt không đụng danh sách đã chụp.

-- AlterTable
ALTER TABLE "khoa_boi_duong" ADD COLUMN "dot_trien_khai_id" UUID;

-- AddForeignKey
ALTER TABLE "khoa_boi_duong" ADD CONSTRAINT "khoa_boi_duong_dot_trien_khai_id_fkey" FOREIGN KEY ("dot_trien_khai_id") REFERENCES "dot_trien_khai"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateIndex
CREATE INDEX "idx_khoa_dot_trien_khai" ON "khoa_boi_duong"("dot_trien_khai_id");
