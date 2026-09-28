import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { DangNhapDto } from './dto/dang-nhap.dto';
import { DoiMatKhauDto } from './dto/doi-mat-khau.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // T1: giới hạn 10 request/phút/IP (mo-rong-nls-an-giang.md mục T1) — chỉ
  // áp cho endpoint này (và GET /hoc-vien/kiem-tra-trung), không đăng ký
  // ThrottlerGuard toàn cục để tránh ảnh hưởng các endpoint khác. Giới hạn
  // thật lấy từ ThrottlerModule.forRoot() ở AppModule — KHÔNG hard-code lại
  // bằng @Throttle() ở đây, vì giá trị trong @Throttle() sẽ có độ ưu tiên
  // cao hơn option của module và làm vô hiệu hóa override trong test
  // (test/utils/test-app.ts raiseThrottlerLimit).
  @Public()
  @UseGuards(ThrottlerGuard)
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
}
