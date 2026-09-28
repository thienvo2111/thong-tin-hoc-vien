import { IsDateString } from 'class-validator';

// PATCH /dot-xac-nhan/{id} (quan_tri) — "gia hạn dong_luc" theo
// mo-rong-nls-an-giang.md mục T14. Chỉ sửa dong_luc, không sửa các trường
// khác (mo_luc/loai/khoa_id cố định từ lúc tạo — tránh đổi phạm vi/ý nghĩa
// của 1 đợt đã có thể có xác nhận gắn vào).
export class SuaDotXacNhanDto {
  @IsDateString()
  dong_luc: string;
}
