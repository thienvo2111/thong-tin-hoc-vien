// Quyết định grill-me 2026-10-01 #7: sau N ngày kể từ lúc được trả lời mà
// học viên không tự bấm "Đã giải quyết", coi như đã đóng khi HIỂN THỊ (tính
// động, không ghi DB) — cùng cách làm với "day_du" ở hoc-vien.service.ts.
export const SO_NGAY_TU_DONG_DONG = 7;

// Quyết định #8: tín hiệu "hỏi lại cùng vấn đề" — ticket mới cùng
// loai_van_de_id trong N ngày sau khi ticket trước đã được trả lời.
export const SO_NGAY_HOI_LAI = 7;
