import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { HoTroHocVienService } from './ho-tro-hoc-vien.service';
import { XuatBuoiHoTroDto } from './dto/ho-tro-hoc-vien.dto';
import {
  XLSX_HEADERS,
  ngayVnTenFile,
} from '../tinh-hinh-di-hoc/tinh-hinh-di-hoc.controller';

// Danh sách + sĩ số THEO BUỔI cho Quản trị, phạm vi toàn hệ thống — cùng logic
// ADR 0008 L7 của người hỗ trợ (phân lớp − đổi ra + đổi vào). Tiền tố /lop
// Nginx đã proxy.
@Roles('quan_tri')
@Controller('lop')
export class LopTheoBuoiController {
  constructor(private readonly service: HoTroHocVienService) {}

  @Get(':lopId/buoi')
  buoiCuaLop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lopId', ParseUUIDPipe) lopId: string,
  ) {
    return this.service.buoiCuaLop(user.id, lopId, 'quan_tri');
  }

  // Khai báo TRƯỚC :lopId/buoi/:lichId/... để 'xuat' không bị route động chắn.
  @Get(':lopId/buoi/xuat')
  async xuatBuoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Query() query: XuatBuoiHoTroDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.xuatDanhSachBuoi(
      user.id,
      'quan_tri',
      lopId,
      query.lich_id,
    );
    res.set(XLSX_HEADERS(`ds-buoi-${ngayVnTenFile()}.xlsx`)).send(buffer);
  }

  @Get(':lopId/buoi/:lichId/hoc-vien')
  hocVienCuaBuoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Param('lichId', ParseUUIDPipe) lichId: string,
  ) {
    return this.service.hocVienCuaBuoi(user.id, lopId, lichId, 'quan_tri');
  }
}
