import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  DuyetDoiBuoiDto,
  GhiChuXuLyDto,
  LocDoiBuoiDto,
  LocThongKeDoiBuoiDto,
} from './dto/doi-buoi-hoc.dto';
import { DoiBuoiHocService } from './doi-buoi-hoc.service';
import { ThongKeDoiBuoiService } from './thong-ke-doi-buoi.service';

// Người duyệt đề nghị đổi buổi (spec §3.2). ho_tro_hoc_vien chỉ thấy cụm của mình.
@Controller('doi-buoi-hoc')
@Roles('quan_tri', 'ho_tro_hoc_vien')
export class DoiBuoiHocController {
  constructor(
    private readonly service: DoiBuoiHocService,
    private readonly thongKeService: ThongKeDoiBuoiService,
  ) {}

  @Get()
  danhSach(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LocDoiBuoiDto,
  ) {
    return this.service.danhSach(user, query);
  }

  @Get('dem-cho-duyet')
  async demChoDuyet(@CurrentUser() user: AuthenticatedUser) {
    // Bọc object: Nest trả số trần dưới dạng text, client JSON không đọc được.
    return { cho_duyet: await this.service.demChoDuyet(user) };
  }

  // Tab Thống kê — khai báo TRƯỚC các route ':id/...'.
  @Get('thong-ke')
  thongKe(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LocThongKeDoiBuoiDto,
  ) {
    return this.thongKeService.thongKe(user, query);
  }

  @Get('thong-ke/xuat-excel')
  async thongKeXuatExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LocThongKeDoiBuoiDto,
    @Res() res: Response,
  ) {
    const buffer = await this.thongKeService.xuatExcel(user, query);
    const p = new Date(Date.now() + 7 * 3600 * 1000).toISOString();
    const ten = `thong-ke-doi-buoi-${p.slice(0, 10).replace(/-/g, '')}-${p.slice(11, 16).replace(':', '')}.xlsx`;
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${ten}"`,
        'Cache-Control': 'no-store',
      })
      .send(buffer);
  }

  @Get('thong-ke/buoi/:lichId')
  thongKeBuoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lichId', ParseUUIDPipe) lichId: string,
    @Query() query: LocThongKeDoiBuoiDto,
  ) {
    return this.thongKeService.chiTietBuoi(user, lichId, query);
  }

  @Get(':id/lua-chon')
  luaChon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.luaChonDuyet(user, id);
  }

  @Post(':id/duyet')
  @HttpCode(HttpStatus.OK)
  duyet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuyetDoiBuoiDto,
  ) {
    return this.service.duyet(user, id, dto);
  }

  @Post(':id/tu-choi')
  @HttpCode(HttpStatus.OK)
  tuChoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GhiChuXuLyDto,
  ) {
    return this.service.tuChoi(user, id, dto);
  }

  @Post(':id/huy-duyet')
  @HttpCode(HttpStatus.OK)
  huyDuyet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GhiChuXuLyDto,
  ) {
    return this.service.huyDuyet(user, id, dto);
  }
}
