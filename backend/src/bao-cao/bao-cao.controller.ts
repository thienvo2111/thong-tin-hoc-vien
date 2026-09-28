import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { BaoCaoService } from './bao-cao.service';
import {
  buildSuaTruongMoetWorkbook,
  buildTongHopWorkbook,
  buildXacNhanWorkbook,
  buildXuatChoVleWorkbook,
} from './util/report-excel.util';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TongHopQueryDto } from './dto/tong-hop-query.dto';
import { XacNhanQueryDto } from './dto/xac-nhan-query.dto';
import { KhoaIdQueryDto } from './dto/khoa-id-query.dto';

// Dịch vụ Báo cáo — docs/api-contract.md mục 7. hoc_vien không có phạm vi
// nghiệp vụ (don_vi) để tổng hợp báo cáo -> không liệt kê trong @Roles(),
// RolesGuard tự trả 403.
@Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri')
@Controller('bao-cao')
export class BaoCaoController {
  constructor(private readonly baoCaoService: BaoCaoService) {}

  @Get('tong-hop')
  tongHop(
    @Query() query: TongHopQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.baoCaoService.tongHop(query, user);
  }

  @Get('xuat-excel')
  async xuatExcel(
    @Query() query: TongHopQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const result = await this.baoCaoService.tongHop(query, user);
    const buffer = await buildTongHopWorkbook(result);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bao-cao-${query.theo}.xlsx"`,
      })
      .send(buffer);
  }

  // T14 — Trường/Phòng/Sở chỉ thấy giáo viên trong phạm vi đơn vị mình (đã
  // xử lý trong BaoCaoService, dùng chung @Roles() của class).
  @Get('xac-nhan')
  xacNhan(
    @Query() query: XacNhanQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.baoCaoService.baoCaoXacNhan(query, user);
  }

  @Get('xac-nhan/xuat-excel')
  async xacNhanXuatExcel(
    @Query() query: XacNhanQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const result = await this.baoCaoService.baoCaoXacNhan(query, user);
    const buffer = await buildXacNhanWorkbook(result.rows);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="bao-cao-xac-nhan.xlsx"',
      })
      .send(buffer);
  }

  // quan_tri-only: đè @Roles() của class (RolesGuard ưu tiên metadata ở
  // handler trước class, xem RolesGuard.getAllAndOverride).
  @Roles('quan_tri')
  @Get('sua-truong-moet')
  suaTruongMoet(@Query() query: KhoaIdQueryDto) {
    return this.baoCaoService.baoCaoSuaTruongMoet(query.khoa_id);
  }

  @Roles('quan_tri')
  @Get('sua-truong-moet/xuat-excel')
  async suaTruongMoetXuatExcel(
    @Query() query: KhoaIdQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.baoCaoService.baoCaoSuaTruongMoet(query.khoa_id);
    const buffer = await buildSuaTruongMoetWorkbook(rows);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="bao-cao-sua-truong-moet.xlsx"',
      })
      .send(buffer);
  }

  @Roles('quan_tri')
  @Get('xuat-cho-vle')
  async xuatChoVle(@Query() query: KhoaIdQueryDto, @Res() res: Response) {
    const rows = await this.baoCaoService.baoCaoXuatChoVle(query.khoa_id);
    const buffer = await buildXuatChoVleWorkbook(rows);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="xuat-cho-vle.xlsx"',
      })
      .send(buffer);
  }
}
