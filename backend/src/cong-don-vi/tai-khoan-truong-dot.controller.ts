import {
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TaiKhoanTruongDotService } from './tai-khoan-truong-dot.service';

// ADR 0015 T4: Quản trị xem/cấp tài khoản cho các trường trong danh sách của đợt.
@Roles('quan_tri')
@Controller('cong-don-vi/dot-trien-khai/:id/tai-khoan-truong')
export class TaiKhoanTruongDotController {
  constructor(private readonly service: TaiKhoanTruongDotService) {}

  @Get()
  danhSach(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.danhSach(id);
  }

  // Response chứa file mật khẩu tạm (base64) — không cache.
  @Post('cap')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  cap(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cap(id, user);
  }
}
