import { IsIn, ValidateIf } from 'class-validator';
import { Y_KIEN_TRUONG, type YKienTruong } from '../quy-tac-hop-dong';

// PUT /cong-don-vi/truong/dot/:dotId/danh-sach/:dongId/y-kien (truong) — issue #61, ADR 0015 X2.
// Bắt buộc gửi khóa y_kien; null = bỏ ý kiến (về "chưa có ý kiến").
export class YKienDongDto {
  @ValidateIf((o: YKienDongDto) => o.y_kien !== null)
  @IsIn(Y_KIEN_TRUONG, {
    message: 'y_kien phải là dong_y, khong_dong_y hoặc null',
  })
  y_kien!: YKienTruong | null;
}
