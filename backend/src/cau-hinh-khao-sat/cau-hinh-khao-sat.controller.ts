import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ForbiddenAppException } from '../common/exceptions/app.exceptions';
import { CauHinhKhaoSatService } from './cau-hinh-khao-sat.service';
import {
  CauHinhKhaoSatDto,
  CauHinhKhaoSatKhoaDto,
} from './dto/cau-hinh-khao-sat.dto';

// Cấu hình khảo sát: chung (mặc định) + riêng theo khóa (2026-10-02).
// @Roles đặt ở từng method, KHÔNG ở class — RolesGuard đọc cả metadata class
// nên @Roles cấp class sẽ chặn luôn route @Public() (không có user).
@Controller('cau-hinh-khao-sat')
export class CauHinhKhaoSatController {
  constructor(private readonly cauHinhKhaoSatService: CauHinhKhaoSatService) {}

  // Công khai: trang chủ. ?tinh=<dia_danh.id> -> cấu hình khóa gắn tỉnh đó
  // (không có -> cấu hình chung); không tham số -> cấu hình chung.
  @Public()
  @Get()
  layCauHinh(
    @Query('tinh', new ParseUUIDPipe({ optional: true })) tinh?: string,
  ) {
    return tinh
      ? this.cauHinhKhaoSatService.layTheoTinh(tinh)
      : this.cauHinhKhaoSatService.layCauHinh();
  }

  // Công khai: danh sách tỉnh cho ô "Chọn tỉnh/thành" ở trang chủ.
  @Public()
  @Get('tinh')
  danhSachTinh() {
    return this.cauHinhKhaoSatService.danhSachTinh();
  }

  // Học viên đăng nhập: cấu hình theo khóa đã ghi danh (cổng học viên, M6, menu).
  @Roles('hoc_vien')
  @Get('cua-toi')
  cuaToi(@CurrentUser() user: AuthenticatedUser) {
    if (!user.hoc_vien_id) {
      throw new ForbiddenAppException('Tài khoản không gắn hồ sơ học viên');
    }
    return this.cauHinhKhaoSatService.layChoHocVien(user.hoc_vien_id);
  }

  @Roles('quan_tri')
  @Put()
  luuCauHinh(
    @Body() dto: CauHinhKhaoSatDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cauHinhKhaoSatService.luuCauHinh(dto, user.id);
  }

  @Roles('quan_tri')
  @Get('khoa/:khoaId')
  layCauHinhKhoa(@Param('khoaId', ParseUUIDPipe) khoaId: string) {
    return this.cauHinhKhaoSatService.layCauHinhKhoa(khoaId);
  }

  @Roles('quan_tri')
  @Put('khoa/:khoaId')
  luuCauHinhKhoa(
    @Param('khoaId', ParseUUIDPipe) khoaId: string,
    @Body() dto: CauHinhKhaoSatKhoaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cauHinhKhaoSatService.luuCauHinhKhoa(
      khoaId,
      dto,
      dto.tinh_id ?? null,
      user.id,
    );
  }

  @Roles('quan_tri')
  @Delete('khoa/:khoaId')
  @HttpCode(204)
  async xoaCauHinhKhoa(@Param('khoaId', ParseUUIDPipe) khoaId: string) {
    await this.cauHinhKhaoSatService.xoaCauHinhKhoa(khoaId);
  }
}
