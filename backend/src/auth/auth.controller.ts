import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TaiKhoanThrottlerGuard } from '../common/guards/tai-khoan-throttler.guard';
import { AuthService } from './auth.service';
import { DangNhapDto } from './dto/dang-nhap.dto';
import { DoiMatKhauDto } from './dto/doi-mat-khau.dto';
import { QuenMatKhauDto } from './dto/quen-mat-khau.dto';
import { DatLaiMatKhauDto } from './dto/dat-lai-mat-khau.dto';
import { XacMinhEmailDto } from './dto/xac-minh-email.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // T1: giới hạn 10 request/phút cho mỗi cặp IP + ten_dang_nhap (2026-10-07:
  // trước là theo IP, nhưng mọi người dùng sau proxy HCMUE/NAT trường chung
  // IP -> xem TaiKhoanThrottlerGuard). Chỉ áp cho endpoint này, quen-mat-khau
  // (và GET /hoc-vien/kiem-tra-trung theo IP), không đăng ký
  // ThrottlerGuard toàn cục để tránh ảnh hưởng các endpoint khác. Giới hạn
  // thật lấy từ ThrottlerModule.forRoot() ở AppModule — KHÔNG hard-code lại
  // bằng @Throttle() ở đây, vì giá trị trong @Throttle() sẽ có độ ưu tiên
  // cao hơn option của module và làm vô hiệu hóa override trong test
  // (test/utils/test-app.ts raiseThrottlerLimit).
  @Public()
  @UseGuards(TaiKhoanThrottlerGuard)
  @Post('dang-nhap')
  @HttpCode(HttpStatus.OK)
  dangNhap(@Body() dto: DangNhapDto) {
    return this.authService.dangNhap(dto);
  }

  @Post('dang-xuat')
  @HttpCode(HttpStatus.OK)
  dangXuat(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.dangXuat(user);
  }

  @Post('doi-mat-khau')
  @HttpCode(HttpStatus.OK)
  doiMatKhau(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DoiMatKhauDto,
  ) {
    return this.authService.doiMatKhau(user, dto);
  }

  @Get('toi')
  layThongTinHienTai(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.layThongTinHienTai(user);
  }

  // 2026-09-30: quên/đặt lại mật khẩu + xác minh email liên hệ. Áp
  // TaiKhoanThrottlerGuard cho quen-mat-khau giống dang-nhap (10 request/phút/IP + tên) —
  // cùng cơ chế 429 hiện có, không tự chế giới hạn riêng.
  @Public()
  @UseGuards(TaiKhoanThrottlerGuard)
  @Post('quen-mat-khau')
  @HttpCode(HttpStatus.OK)
  quenMatKhau(@Body() dto: QuenMatKhauDto) {
    return this.authService.quenMatKhau(dto);
  }

  @Public()
  @Post('dat-lai-mat-khau')
  @HttpCode(HttpStatus.OK)
  datLaiMatKhau(@Body() dto: DatLaiMatKhauDto) {
    return this.authService.datLaiMatKhau(dto);
  }

  @Public()
  @Post('xac-minh-email')
  @HttpCode(HttpStatus.OK)
  xacMinhEmail(@Body() dto: XacMinhEmailDto) {
    return this.authService.xacMinhEmail(dto);
  }
}
