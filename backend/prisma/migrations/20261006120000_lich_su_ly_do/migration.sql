-- ADR 0003 H7 (2026-10-06): lý do bắt buộc khi người hỗ trợ học viên sửa hồ sơ hộ.
ALTER TABLE "lich_su_thay_doi_ho_so" ADD COLUMN "ly_do" TEXT;
