import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThongKeService } from './thong-ke.service';
import {
  CanDonDocQueryDto,
  ThongKeQueryDto,
  XepHangQueryDto,
} from './dto/thong-ke-query.dto';
import { CanDonDocService } from './can-don-doc.service';
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
}
