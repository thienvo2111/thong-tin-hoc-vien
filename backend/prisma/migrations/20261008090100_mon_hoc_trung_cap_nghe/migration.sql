-- 2026-10-08: môn duy nhất của cấp "Trung cấp nghề".
INSERT INTO "mon_hoc" ("ten_mon", "cap_hoc")
VALUES ('Các môn trung cấp nghề', 'trung_cap_nghe')
ON CONFLICT ("ten_mon", "cap_hoc") DO NOTHING;
