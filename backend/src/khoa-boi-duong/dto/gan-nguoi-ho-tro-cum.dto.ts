import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

// ADR 0003: PUT /khoa-boi-duong/{id}/cum/{cumId}/nguoi-ho-tro — danh sách
// thay toàn bộ (rỗng = gỡ hết).
export class GanNguoiHoTroCumDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  nguoi_dung_ids!: string[];
}
