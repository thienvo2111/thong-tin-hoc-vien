-- T5 (mo-rong-nls-an-giang.md, 2026-09-29): migration B — 2 cột mức năng
-- lực đầu vào/đầu ra trên dang_ky_hoc, dùng type muc_nang_luc tạo ở migration
-- A (20260929033535_t5_muc_nang_luc_enum).

-- AlterTable
ALTER TABLE "dang_ky_hoc" ADD COLUMN     "muc_dau_ra" "muc_nang_luc",
ADD COLUMN     "muc_dau_vao" "muc_nang_luc";
