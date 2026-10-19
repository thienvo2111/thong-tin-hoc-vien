import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TinhHinhDiHocService } from './tinh-hinh-di-hoc.service';
import {
  DiemDanhBoSungQuanTriDto,
  LocTinhHinhDiHocDto,
} from './tinh-hinh-di-hoc.dto';

/** yyyymmdd theo giờ Việt Nam — đặt tên file xuất. */
export const ngayVnTenFile = () =>
  new Date(Date.now() + 7 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');

export const XLSX_HEADERS = (tenFile: string) => ({
  'Content-Type':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'Content-Disposition': `attachment; filename="${tenFile}"`,
  'Cache-Control': 'no-store',
});

// ADR 0010 T5: Quản trị xem tình hình đi học của mọi học viên + sửa điểm
// danh như Z7. Đặt dưới tiền tố /thong-ke sẵn có (Nginx đã proxy) — không
// phải thêm tiền tố mới trên VPS.
@Roles('quan_tri')
@Controller('thong-ke/di-hoc')
export class TinhHinhDiHocController {
  constructor(private readonly service: TinhHinhDiHocService) {}

  @Get()
  danhSach(@Query() query: LocTinhHinhDiHocDto) {
    return this.service.danhSach({}, query);
  }

  // Khai báo TRƯỚC :dangKyHocId để 'khoa'/'xuat' không bị route động chắn.
  @Get('khoa')
  khoa() {
    return this.service.khoaChoLoc({}, null);
  }

  @Get('xuat')
  async xuat(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LocTinhHinhDiHocDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.xuat({}, query, user);
    res
      .set(XLSX_HEADERS(`tinh-hinh-di-hoc-${ngayVnTenFile()}.xlsx`))
      .send(buffer);
  }

  @Get(':dangKyHocId')
  chiTiet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dangKyHocId', ParseUUIDPipe) dangKyHocId: string,
  ) {
    return this.service.chiTiet({}, dangKyHocId, user);
  }

  @Put(':dangKyHocId/diem-danh')
  diemDanh(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dangKyHocId', ParseUUIDPipe) dangKyHocId: string,
    @Body() dto: DiemDanhBoSungQuanTriDto,
  ) {
    return this.service.diemDanhBoSung({}, dangKyHocId, user, dto);
  }
}
