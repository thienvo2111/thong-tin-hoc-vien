import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { BaoCaoService } from './bao-cao.service';
import { buildTongHopWorkbook } from './util/report-excel.util';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TongHopQueryDto } from './dto/tong-hop-query.dto';

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
}
