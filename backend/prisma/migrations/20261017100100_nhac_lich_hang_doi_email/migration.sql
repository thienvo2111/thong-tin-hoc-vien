-- 2026-10-17, ADR 0009 (email lịch giảng dạy): chỉ thêm cột nullable, không đụng dữ liệu cũ.
-- NULL = kênh tin nhắn (Zalo/SMS, như cũ); có giá trị = lần gửi qua email (dòng hàng đợi).
-- Rollback: DROP INDEX "idx_nhac_lich_hang_doi"; ALTER TABLE "nhat_ky_nhac_lich" DROP COLUMN "hang_doi_email_id";
ALTER TABLE "nhat_ky_nhac_lich" ADD COLUMN "hang_doi_email_id" UUID;

CREATE INDEX "idx_nhac_lich_hang_doi" ON "nhat_ky_nhac_lich"("hang_doi_email_id");

ALTER TABLE "nhat_ky_nhac_lich" ADD CONSTRAINT "nhat_ky_nhac_lich_hang_doi_email_id_fkey"
    FOREIGN KEY ("hang_doi_email_id") REFERENCES "hang_doi_email"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
