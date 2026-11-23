import { IsISO8601, Matches, ValidateIf } from 'class-validator';
import { NGAY } from '../quy-tac-hop-dong';
import { LyDoDto } from './danh-sach-tham-gia.dto';

const MSG_HAN_RIENG = {
  message: 'han_rieng phải là ngày dạng YYYY-MM-DD hoặc null',
};

// Issue #66 / ADR 0015 T3: PUT .../hop-dong/:donViId/han-rieng — gia hạn riêng 1 trường.
// han_rieng: 'YYYY-MM-DD' (lưu 23:59:59 giờ VN) hoặc null = bỏ hạn riêng; phải gửi (vắng → 400).
// ly_do bắt buộc (không trống sau trim, ≤ 500). "Từ hôm nay trở đi" kiểm ở service (cần đồng hồ server).
export class HanRiengDto extends LyDoDto {
  @ValidateIf((o: { han_rieng?: unknown }) => o.han_rieng !== null)
  @Matches(NGAY, MSG_HAN_RIENG)
  @IsISO8601({ strict: true }, MSG_HAN_RIENG)
  han_rieng!: string | null;
}
