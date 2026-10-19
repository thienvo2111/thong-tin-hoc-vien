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
  Put,
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
  XuatBuoiHoTroDto,
  XuatLopHoTroDto,
} from './dto/ho-tro-hoc-vien.dto';
import { VanHanhHocVienService } from './van-hanh-hoc-vien.service';
import { NhacLichService } from '../nhac-lich/nhac-lich.service';
import { HoTroHocVienScopeService } from './ho-tro-hoc-vien-scope.service';
import { GhiNhacCumDto, TinNhanCumQueryDto } from '../nhac-lich/nhac-lich.dto';
import {
  BaoVangDto,
  LopCoTheDoiQueryDto,
  TaoDeNghiDoiLopDto,
} from './dto/van-hanh-hoc-vien.dto';
import { TinhHinhDiHocService } from '../tinh-hinh-di-hoc/tinh-hinh-di-hoc.service';
import {
  DiemDanhBoSungHoTroDto,
  LocTinhHinhDiHocDto,
} from '../tinh-hinh-di-hoc/tinh-hinh-di-hoc.dto';
import { XLSX_HEADERS } from '../tinh-hinh-di-hoc/tinh-hinh-di-hoc.controller';

/** yyyymmdd theo giờ Việt Nam — đặt tên file xuất. */
const ngayVn = () =>
  new Date(Date.now() + 7 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');

// Khu làm việc người hỗ trợ học viên (ADR 0003). Chỉ ho_tro_hoc_vien — Quản
// trị dùng các API /admin của mình, không đi qua đây.
@Roles('ho_tro_hoc_vien')
@Controller('ho-tro-hoc-vien')
export class HoTroHocVienController {
  constructor(
    private readonly service: HoTroHocVienService,
    private readonly vanHanh: VanHanhHocVienService,
    private readonly nhacLich: NhacLichService,
    private readonly scope: HoTroHocVienScopeService,
    private readonly diHoc: TinhHinhDiHocService,
  ) {}

  // ---------------- ADR 0010: tình hình đi học + điểm danh bổ sung ----------------
  // Phạm vi = cụm ∪ lớp gốc (T1); cum_id ngoài cụm của tôi → 404 như cumLoc.
  private async phamViDiHoc(userId: string, cumId?: string) {
    if (cumId) await this.scope.cumLoc(userId, cumId);
    return this.scope.whereDangKyTrongPhamVi(userId);
  }

  @Get('di-hoc')
  async danhSachDiHoc(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LocTinhHinhDiHocDto,
  ) {
    return this.diHoc.danhSach(
      await this.phamViDiHoc(user.id, query.cum_id),
      query,
    );
  }

  // Khai báo TRƯỚC di-hoc/:dangKyHocId để 'khoa'/'xuat' không bị route động chắn.
  @Get('di-hoc/khoa')
  async diHocKhoa(@CurrentUser() user: AuthenticatedUser) {
    return this.diHoc.khoaChoLoc(
      await this.scope.whereDangKyTrongPhamVi(user.id),
      await this.scope.cumIdsCuaToi(user.id),
    );
  }

  @Get('di-hoc/xuat')
  async xuatDiHoc(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LocTinhHinhDiHocDto,
    @Res() res: Response,
  ) {
    const buffer = await this.diHoc.xuat(
      await this.phamViDiHoc(user.id, query.cum_id),
      query,
      user,
    );
    res.set(XLSX_HEADERS(`tinh-hinh-di-hoc-${ngayVn()}.xlsx`)).send(buffer);
  }

  @Get('di-hoc/:dangKyHocId')
  async chiTietDiHoc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dangKyHocId', ParseUUIDPipe) dangKyHocId: string,
  ) {
    return this.diHoc.chiTiet(
      await this.scope.whereDangKyTrongPhamVi(user.id),
      dangKyHocId,
      user,
    );
  }

  @Put('di-hoc/:dangKyHocId/diem-danh')
  async diemDanhBoSung(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dangKyHocId', ParseUUIDPipe) dangKyHocId: string,
    @Body() dto: DiemDanhBoSungHoTroDto,
  ) {
    return this.diHoc.diemDanhBoSung(
      await this.scope.whereDangKyTrongPhamVi(user.id),
      dangKyHocId,
      user,
      dto,
    );
  }

  // ---------------- ADR 0004 L8 (issue #21): tin nhắn nhắc cụm ----------------
  @Get('cum/:cumId/tin-nhan-nhac')
  async tinNhanNhacCum(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cumId', ParseUUIDPipe) cumId: string,
    @Query() query: TinNhanCumQueryDto,
  ) {
    await this.scope.cumLoc(user.id, cumId);
    return this.nhacLich.tinNhanCum(cumId, query.ngay);
  }

  @Post('nhac-lich')
  async daGuiNhacCum(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GhiNhacCumDto,
  ) {
    await this.scope.cumLoc(user.id, dto.cum_id);
    return this.nhacLich.ghiNhacCum(user, dto);
  }

  @Get('nhac-lich/dem')
  async demNhacLich(@CurrentUser() user: AuthenticatedUser) {
    return {
      can_nhac: await this.nhacLich.demCanNhacCum(
        await this.scope.cumIdsCuaToi(user.id),
      ),
    };
  }

  @Get('cum-cua-toi')
  cumCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.service.cumCuaToi(user.id);
  }

  // ---------------- ADR 0008: hỗ trợ theo lớp ----------------
  @Get('lop-cua-toi')
  lopCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.service.lopCuaToi(user.id);
  }

  // Khai báo TRƯỚC lop/:lopId/... để 'xuat' không bị route động chắn.
  @Get('lop/xuat')
  async xuatLop(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: XuatLopHoTroDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.xuatDanhSachLop(
      user.id,
      'ho_tro_hoc_vien',
      query.lop_id,
    );
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ds-lop-ho-tro-${ngayVn()}.xlsx"`,
        'Cache-Control': 'no-store',
      })
      .send(buffer);
  }

  // ADR 0008 L7: danh sách theo buổi (phân lớp − đổi ra + đổi vào).
  @Get('lop/:lopId/buoi')
  buoiCuaLop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lopId', ParseUUIDPipe) lopId: string,
  ) {
    return this.service.buoiCuaLop(user.id, lopId);
  }

  // Khai báo TRƯỚC lop/:lopId/buoi/:lichId/... để 'xuat' không bị route động chắn.
  @Get('lop/:lopId/buoi/xuat')
  async xuatBuoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Query() query: XuatBuoiHoTroDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.xuatDanhSachBuoi(
      user.id,
      'ho_tro_hoc_vien',
      lopId,
      query.lich_id,
    );
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ds-buoi-${ngayVn()}.xlsx"`,
        'Cache-Control': 'no-store',
      })
      .send(buffer);
  }

  @Get('lop/:lopId/buoi/:lichId/hoc-vien')
  hocVienCuaBuoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Param('lichId', ParseUUIDPipe) lichId: string,
  ) {
    return this.service.hocVienCuaBuoi(user.id, lopId, lichId);
  }

  @Get('lop/:lopId/hoc-vien')
  hocVienCuaLop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lopId', ParseUUIDPipe) lopId: string,
  ) {
    return this.service.hocVienCuaLop(user.id, lopId);
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
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ds-cum-ho-tro-${ngayVn()}.xlsx"`,
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
