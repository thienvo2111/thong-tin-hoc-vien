import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Rate limit theo TÀI KHOẢN đăng nhập (JWT user.id) thay vì IP — dùng cho
// endpoint mà nhiều người dùng chung 1 IP (NAT trường, proxy HCMUE) nên
// đếm theo IP sẽ chặn chung cả phòng máy. Guard này chạy SAU JwtAuthGuard
// (APP_GUARD toàn cục, xem auth.module.ts) nên request.user đã có sẵn khi
// getTracker gọi tới. Không có user (vd token hết hạn lọt qua @Public) ->
// rơi về IP như ThrottlerGuard gốc.
@Injectable()
export class NguoiDungThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    if (userId) return `nguoi_dung:${userId}`;
    return super.getTracker(req);
  }
}
