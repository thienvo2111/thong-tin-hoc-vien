import {
  Body,
  Controller,
  Delete,
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
import { VanHanhHocVienService } from './van-hanh-hoc-vien.service';
import {
  BaoVangDto,
  LopCoTheDoiQueryDto,
  TaoDeNghiDoiLopDto,
} from './dto/van-hanh-hoc-vien.dto';

// Khu làm việc người hỗ trợ học viên (ADR 0003). Chỉ ho_tro_hoc_vien — Quản
// trị dùng các API /admin của mình, không đi qua đây.
@Roles('ho_tro_hoc_vien')
@Controller('ho-tro-hoc-vien')
export class HoTroHocVienController {
  constructor(
    private readonly service: HoTroHocVienService,
    private readonly vanHanh: VanHanhHocVienService,
  ) {}

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
  async chiTiet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // chiTietHocVien kiểm phạm vi trước; báo vắng/đề nghị (issue #18) gộp sau.
    const ct = await this.service.chiTietHocVien(user.id, id);
    return { ...ct, ...(await this.vanHanh.cuaHocVien(id)) };
  }

  // ---------------- ADR 0004 L5 (issue #18) ----------------
  @Post('hoc-vien/:id/bao-vang')
  baoVang(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BaoVangDto,
  ) {
    return this.vanHanh.baoVang(user, id, dto);
  }

  @Delete('hoc-vien/:id/bao-vang/:lichHocId')
  @HttpCode(HttpStatus.NO_CONTENT)
  huyBaoVang(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lichHocId', ParseUUIDPipe) lichHocId: string,
  ) {
    return this.vanHanh.huyBaoVang(user, id, lichHocId);
  }

  @Get('hoc-vien/:id/lop-co-the-doi')
  lopCoTheDoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LopCoTheDoiQueryDto,
  ) {
    return this.vanHanh.lopCoTheDoi(user, id, query.giai_doan_id);
  }

  @Post('hoc-vien/:id/de-nghi-doi-lop')
  taoDeNghi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaoDeNghiDoiLopDto,
  ) {
    return this.vanHanh.taoDeNghi(user, id, dto);
  }

  @Post('de-nghi-doi-lop/:id/huy')
  @HttpCode(HttpStatus.NO_CONTENT)
  huyDeNghi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vanHanh.huyDeNghi(user, id);
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
