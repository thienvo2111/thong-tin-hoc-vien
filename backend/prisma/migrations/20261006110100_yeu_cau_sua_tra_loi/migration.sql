-- ADR 0003 H12 (2026-10-06): Quản trị sửa câu trả lời yêu cầu hỗ trợ.
ALTER TABLE "yeu_cau_ho_tro" ADD COLUMN "thoi_gian_sua_tra_loi" TIMESTAMPTZ(6),
ADD COLUMN "sua_tra_loi_boi" UUID;

ALTER TABLE "yeu_cau_ho_tro" ADD CONSTRAINT "yeu_cau_ho_tro_sua_tra_loi_boi_fkey"
    FOREIGN KEY ("sua_tra_loi_boi") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
