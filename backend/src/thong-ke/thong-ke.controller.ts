import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThongKeService } from './thong-ke.service';
import {
  CanDonDocQueryDto,
  MucNlsQueryDto,
  ThongKeQueryDto,
  XepHangQueryDto,
} from './dto/thong-ke-query.dto';
import { BieuMauService } from './bieu-mau.service';
import { ChatLuongHoSoService } from './chat-luong-ho-so.service';
import { CanDonDocService } from './can-don-doc.service';
import { DanhSachHocVienService } from './danh-sach-hoc-vien.service';
import { MucNlsService } from './muc-nls.service';
import { NhuCauMucHocService } from './nhu-cau-muc-hoc.service';
import { NhuCauMucDotService } from './nhu-cau-muc-dot.service';
import { NhuCauMucDotQueryDto } from './dto/nhu-cau-muc-dot-query.dto';
import { homNayVN } from '../nhu-cau-muc/util/moc-nhu-cau.util';
import { TienDoTruongService } from './tien-do-truong.service';
import { XepHangService } from './xep-hang.service';

// hoc_vien không có phạm vi thống kê -> RolesGuard tự trả 403.
@Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri', 'ho_tro_hoc_vien')
@Controller('thong-ke')
export class ThongKeController {
  constructor(
    private readonly scopeService: ThongKeScopeService,
    private readonly service: ThongKeService,
    private readonly xepHangService: XepHangService,
    private readonly canDonDocService: CanDonDocService,
    private readonly tienDoTruongService: TienDoTruongService,
    private readonly bieuMauService: BieuMauService,
    private readonly chatLuongHoSoService: ChatLuongHoSoService,
    private readonly mucNlsService: MucNlsService,
    private readonly nhuCauMucHocService: NhuCauMucHocService,
    private readonly danhSachHocVienService: DanhSachHocVienService,
    private readonly nhuCauMucDotService: NhuCauMucDotService,
  ) {}

  @Get('bo-loc')
  boLoc(@CurrentUser() user: AuthenticatedUser) {
    return this.scopeService.boLoc(user);
  }

  @Get('pheu')
  pheu(@CurrentUser() user: AuthenticatedUser, @Query() q: ThongKeQueryDto) {
    return this.service.pheu(user, q);
  }

  @Get('khao-sat')
  khaoSat(@CurrentUser() user: AuthenticatedUser, @Query() q: ThongKeQueryDto) {
    return this.service.khaoSat(user, q);
  }

  @Get('chuyen-muc')
  chuyenMuc(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
  ) {
    return this.service.chuyenMuc(user, q);
  }

  @Get('nhu-cau-muc-hoc')
  nhuCauMucHoc(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
  ) {
    return this.nhuCauMucHocService.danhSach(user, q);
  }

  @Get('nhu-cau-muc-hoc/xuat-excel')
  async nhuCauMucHocXuatExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.nhuCauMucHocService.xuatExcel(user, q);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="nhu-cau-muc-hoc.xlsx"',
      })
      .send(buffer);
  }

  // ADR 0013: nhu cầu mức học theo đợt (khoa_id theo đợt).
  @Get('nhu-cau-muc-dot')
  nhuCauMucDot(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: NhuCauMucDotQueryDto,
  ) {
    return this.nhuCauMucDotService.thongKe(user, q);
  }

  // Mỗi đăng ký 1 dòng (có PII); don_vi_ids rỗng = toàn phạm vi tài khoản.
  @Get('nhu-cau-muc-dot/xuat-excel')
  async nhuCauMucDotXuatExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: NhuCauMucDotQueryDto,
    @Res() res: Response,
  ) {
    const { buffer, dot } = await this.nhuCauMucDotService.xuatExcel(user, q);
    const ngay = homNayVN().replace(/-/g, '');
    const ten = `nhu-cau-muc-${dot.ma_khoa}-${ngay}.xlsx`;
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${ten.replace(/[^\w.-]/g, '_')}"`,
        'Cache-Control': 'no-store',
      })
      .send(buffer);
  }

  @Get('ket-qua')
  ketQua(@CurrentUser() user: AuthenticatedUser, @Query() q: ThongKeQueryDto) {
    return this.service.ketQuaHoc(user, q);
  }

  @Get('ket-qua-theo-truong')
  ketQuaTheoTruong(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
  ) {
    return this.service.ketQuaHocTheoTruong(user, q);
  }

  @Get('so-sanh-khoa')
  soSanhKhoa(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
  ) {
    return this.service.soSanhKhoa(user, q);
  }

  @Get('chuyen-can')
  chuyenCan(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
  ) {
    return this.service.chuyenCan(user, q);
  }

  @Get('xep-hang')
  xepHang(@CurrentUser() user: AuthenticatedUser, @Query() q: XepHangQueryDto) {
    return this.xepHangService.xepHang(user, q);
  }

  @Get('can-don-doc')
  canDonDoc(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: CanDonDocQueryDto,
  ) {
    return this.canDonDocService.danhSach(user, q);
  }

  @Get('can-don-doc/xuat-excel')
  async canDonDocXuatExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: CanDonDocQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.canDonDocService.xuatExcel(user, q);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="can-don-doc.xlsx"',
      })
      .send(buffer);
  }

  // Mỗi học viên 1 dòng (có PII) + truy cập / KS kĩ năng số / đánh giá NLS.
  // Chọn nhiều trường qua don_vi_ids; bỏ trống = toàn bộ phạm vi tài khoản.
  @Get('danh-sach-hoc-vien/xuat-excel')
  async danhSachHocVienXuatExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.danhSachHocVienService.xuatExcel(user, q);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="danh-sach-hoc-vien.xlsx"',
        'Cache-Control': 'no-store',
      })
      .send(buffer);
  }

  @Get('tien-do-truong')
  tienDoTruong(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
  ) {
    return this.tienDoTruongService.danhSach(user, q);
  }

  @Get('tien-do-truong/xuat-excel')
  async tienDoTruongXuatExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.tienDoTruongService.xuatExcel(user, q);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="tien-do-theo-truong.xlsx"',
      })
      .send(buffer);
  }

  @Get('chat-luong-ho-so')
  chatLuongHoSo(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
  ) {
    return this.chatLuongHoSoService.danhSach(user, q);
  }

  @Get('chat-luong-ho-so/xuat-excel')
  async chatLuongHoSoXuatExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.chatLuongHoSoService.xuatExcel(user, q);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="chat-luong-ho-so.xlsx"',
      })
      .send(buffer);
  }

  @Get('muc-nls')
  mucNls(@CurrentUser() user: AuthenticatedUser, @Query() q: MucNlsQueryDto) {
    return this.mucNlsService.danhSach(user, q);
  }

  @Get('muc-nls/xuat-excel')
  async mucNlsXuatExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: MucNlsQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.mucNlsService.xuatExcel(user, q);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="muc-nls-${
          q.loai === 'dau_ra' ? 'dau-ra' : 'dau-vao'
        }.xlsx"`,
      })
      .send(buffer);
  }

  @Get('bieu-mau/dang-ky-truy-cap/xuat-excel')
  async bieuMauDangKyTruyCapXuatExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.bieuMauService.xuatDangKyTruyCap(user, q);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="bieu-mau-dang-ky-truy-cap.xlsx"',
      })
      .send(buffer);
  }
}
