-- T1 Bảo mật đăng nhập — xem docs/mo-rong-nls-an-giang.md mục T1.
-- Bỏ 4 DROP INDEX mà `prisma migrate dev` tự sinh (nhắm vào GIN trgm index
-- chỉ tồn tại dưới dạng raw SQL, không khai báo trong schema.prisma) — cùng
-- gotcha đã ghi trong README.md gốc repo, mục "Gotcha khi thêm migration mới".

-- AlterTable
ALTER TABLE "nguoi_dung" ADD COLUMN     "dang_nhap_lan_cuoi" TIMESTAMPTZ(6),
ADD COLUMN     "khoa_den" TIMESTAMPTZ(6),
ADD COLUMN     "so_lan_dang_nhap_sai" SMALLINT NOT NULL DEFAULT 0;
