import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler';

// Bucket theo tài khoản hẹp hơn bucket theo IP nên cho gấp đôi giới hạn gốc
// của ThrottlerModule (10 -> 20 lượt/phút). Nhân hệ số thay vì hard-code số
// để override limit trong test (raiseThrottlerLimit) vẫn có tác dụng.
export const HE_SO_GIOI_HAN_TAI_KHOAN = 2;

// Rate limit cho POST /auth/dang-nhap và /auth/quen-mat-khau: đếm theo cặp
// IP + ten_dang_nhap thay vì chỉ IP. Cả trường (NAT chung) hay mọi người dùng
// sau proxy HCMUE có thể chung 1 IP — chỉ đếm theo IP thì 10 lượt/phút cho
// cả nhóm, ai cũng gặp 429. Dò mật khẩu 1 tài khoản đã có khóa tài khoản
// (423, AuthService) chặn riêng. Tên đăng nhập so khớp không phân biệt
// hoa/thường để "ABC" và "abc" không thành 2 bucket.
@Injectable()
export class TaiKhoanThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ten = String(req.body?.ten_dang_nhap ?? '')
      .trim()
      .toLowerCase();
    return `${req.ip}|${ten}`;
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    return super.handleRequest({
      ...requestProps,
      limit: requestProps.limit * HE_SO_GIOI_HAN_TAI_KHOAN,
    });
  }
}
