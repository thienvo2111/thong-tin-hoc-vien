import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

// ADR 0009: lô gửi email lịch giảng dạy — 1 email / giảng viên được chọn.
export class GuiEmailLichDayDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  giang_vien_ids!: string[];
}
