-- T17 (2026-09-30): phân biệt xã/phường HIỆN TẠI (sau đợt sáp nhập hành
-- chính 2025, còn 34 tỉnh/thành) với mã xã/phường LỊCH SỬ (mã cũ trước sáp
-- nhập, vẫn giữ lại trong dia_danh để don_vi_cong_tac có thể lưu đúng lịch
-- sử công tác của giáo viên tại thời điểm chưa sáp nhập) và các dòng ĐẶC
-- BIỆT (placeholder, không phải địa giới hành chính thật).
--
-- CHỈ ADD COLUMN/ENUM + UPDATE dữ liệu (gán phien_ban, đổi tên 4 dòng
-- "Trường THPT" của An Giang cho rõ nghĩa) — KHÔNG xoá bất kỳ dòng dia_danh
-- nào, kể cả các mã lịch sử/đặc biệt đang được don_vi_cong_tac tham chiếu.

-- CreateEnum
CREATE TYPE "phien_ban_dia_danh" AS ENUM ('hien_tai', 'lich_su', 'dac_biet');

-- AlterTable: thêm cột mới, mặc định hien_tai cho mọi dòng hiện có (không
-- cần UPDATE riêng cho phần "hiện tại" — chỉ 2 nhóm dưới đây mới cần đổi).
ALTER TABLE "dia_danh" ADD COLUMN "phien_ban" "phien_ban_dia_danh" NOT NULL DEFAULT 'hien_tai';

-- (a) Mã LỊCH SỬ: với mỗi dòng cấp phường/xã có mã DÀI (>5 ký tự, dạng
-- {mã ngắn}+"01") mà tồn tại 1 dòng KHÁC cùng parent_id, cùng tên, mã NGẮN
-- (<=5 ký tự) — đây là cặp trùng do dữ liệu vừa có mã cũ vừa có mã mới sau
-- sáp nhập. Gán dòng mã DÀI = lich_su (dòng mã ngắn giữ nguyên hien_tai).
-- Áp dụng cho TOÀN HỆ THỐNG (không giới hạn 1 tỉnh) — dự kiến ~90 nhóm.
UPDATE "dia_danh" dd
SET "phien_ban" = 'lich_su'
WHERE dd."cap" = 'phuong_xa_dac_khu'
  AND LENGTH(dd."ma") > 5
  AND EXISTS (
    SELECT 1 FROM "dia_danh" d2
    WHERE d2."parent_id" = dd."parent_id"
      AND d2."ten" = dd."ten"
      AND LENGTH(d2."ma") <= 5
      AND d2."id" <> dd."id"
  );

-- (b) 4 dòng "Trường THPT" của An Giang (trùng tên nhau, dùng làm "địa bàn"
-- placeholder cho don_vi_cong_tac không có xã cụ thể) — đổi tên cho rõ
-- nghĩa (không còn trùng nhau) + gán dac_biet. Dùng đúng id (không dùng
-- điều kiện chung vì tên "Trường THPT" quá chung chung để tự nhận diện an
-- toàn). Giữ nguyên mã (91801-91804) để không phá unique constraint.
UPDATE "dia_danh" SET "phien_ban" = 'dac_biet', "ten" = 'Khu vực đặc biệt 1 (không theo xã cụ thể)' WHERE "id" = '1b4d335b-c5cb-4c11-beaa-a86e72fcca41';
UPDATE "dia_danh" SET "phien_ban" = 'dac_biet', "ten" = 'Khu vực đặc biệt 2NT (không theo xã cụ thể)' WHERE "id" = '158dd069-2270-445e-8e44-5c6614bdafa8';
UPDATE "dia_danh" SET "phien_ban" = 'dac_biet', "ten" = 'Khu vực đặc biệt 2 (không theo xã cụ thể)' WHERE "id" = 'a11da45b-44f0-46f7-9f8c-2614bca0ec6a';
UPDATE "dia_danh" SET "phien_ban" = 'dac_biet', "ten" = 'Khu vực đặc biệt khác (công an/quân nhân, học nước ngoài...)' WHERE "id" = '09ba2f66-d5cc-4525-9262-6c682d2b542e';

-- (c) Các dòng placeholder/sentinel khác (vd "Xã chưa xác định (...)") —
-- nhận diện qua mã chứa "CHUAXACDINH" hoặc tên chứa "chưa xác định". Chỉ
-- đổi phien_ban, giữ nguyên tên.
UPDATE "dia_danh"
SET "phien_ban" = 'dac_biet'
WHERE "ma" ILIKE '%CHUAXACDINH%' OR "ten" ILIKE '%chưa xác định%';
