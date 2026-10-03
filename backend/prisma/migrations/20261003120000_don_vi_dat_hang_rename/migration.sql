-- Đổi tên cột khoa_boi_duong.don_vi_to_chuc_id -> don_vi_dat_hang_id
-- (không đổi hành vi — "đơn vị đặt hàng" thay "đơn vị tổ chức" là bước đặt
-- lại tên gọi, các bước sau trong kế hoạch mới đổi logic/luồng duyệt).
ALTER TABLE "khoa_boi_duong" RENAME COLUMN "don_vi_to_chuc_id" TO "don_vi_dat_hang_id";

ALTER TABLE "khoa_boi_duong" RENAME CONSTRAINT "khoa_boi_duong_don_vi_to_chuc_id_fkey" TO "khoa_boi_duong_don_vi_dat_hang_id_fkey";
