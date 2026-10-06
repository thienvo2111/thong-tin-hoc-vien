import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { HoTroHocVienService } from './ho-tro-hoc-vien.service';
import {
  LocHocVienHoTroDto,
  LocLichHocHoTroDto,
  SuaHoSoHoTroDto,
} from './dto/ho-tro-hoc-vien.dto';

// Khu làm việc người hỗ trợ học viên (ADR 0003). Chỉ ho_tro_hoc_vien — Quản
// trị dùng các API /admin của mình, không đi qua đây.
@Roles('ho_tro_hoc_vien')
@Controller('ho-tro-hoc-vien')
export class HoTroHocVienController {
  constructor(private readonly service: HoTroHocVienService) {}

  @Get('cum-cua-toi')
  cumCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.service.cumCuaToi(user.id);
  }

  @Get('hoc-vien')
  danhSach(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LocHocVienHoTroDto,
  ) {
    return this.service.danhSachHocVien(user.id, query);
  }

  // Khai báo TRƯỚC hoc-vien/:id để 'xuat' không bị route động chắn.
  @Get('hoc-vien/xuat')
  async xuat(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LocHocVienHoTroDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.xuatDanhSach(
      user.id,
      'ho_tro_hoc_vien',
      query,
    );
    const ngay = new Date(Date.now() + 7 * 3600 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ds-cum-ho-tro-${ngay}.xlsx"`,
        'Cache-Control': 'no-store',
      })
      .send(buffer);
  }

  @Get('hoc-vien/:id')
  chiTiet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.chiTietHocVien(user.id, id);
  }

  @Get('lich-hoc')
  lichHoc(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LocLichHocHoTroDto,
  ) {
    return this.service.lichHoc(user.id, query);
  }

  // Lát 3 (ADR 0003 H7–H9).
  @Patch('hoc-vien/:id')
  suaHoSo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuaHoSoHoTroDto,
  ) {
    return this.service.suaHoSo(user, id, dto);
  }

  @Post('hoc-vien/:id/gui-link-dat-lai-mat-khau')
  @HttpCode(HttpStatus.OK)
  guiLinkDatLaiMatKhau(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.guiLinkDatLaiMatKhau(user.id, id);
  }

  @Post('hoc-vien/:id/cap-mat-khau-tam')
  @HttpCode(HttpStatus.OK)
  capMatKhauTam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.capMatKhauTam(user.id, id);
  }

  @Post('hoc-vien/:id/mo-khoa-tam')
  @HttpCode(HttpStatus.OK)
  moKhoaTam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.moKhoaTam(user.id, id);
  }
}
