-- 2026-10-19, ADR 0012: học viên đăng ký học bù buổi đã vắng (dùng chung bảng doi_buoi_hoc).
-- Chỉ thêm: 1 enum + 2 cột có mặc định. Mọi dòng cũ = 'doi_buoi'; học bù tắt ở mọi khóa (0).
-- Hai unique uq_doi_buoi_cho / uq_doi_buoi_da_duyet giữ nguyên (theo (đăng ký, buổi gốc), không theo loại — B6).
-- Rollback (chỉ khi chưa có dòng loai = 'hoc_bu'):
--   ALTER TABLE "doi_buoi_hoc" DROP COLUMN "loai";
--   ALTER TABLE "khoa_boi_duong" DROP COLUMN "so_buoi_hoc_bu_toi_da";
--   DROP TYPE "loai_doi_buoi";
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20261019120000_hoc_bu';

CREATE TYPE "loai_doi_buoi" AS ENUM ('doi_buoi', 'hoc_bu');
ALTER TABLE "doi_buoi_hoc" ADD COLUMN "loai" "loai_doi_buoi" NOT NULL DEFAULT 'doi_buoi';
ALTER TABLE "khoa_boi_duong" ADD COLUMN "so_buoi_hoc_bu_toi_da" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "khoa_boi_duong" ADD CONSTRAINT "chk_khoa_so_buoi_hoc_bu" CHECK ("so_buoi_hoc_bu_toi_da" BETWEEN 0 AND 50);
