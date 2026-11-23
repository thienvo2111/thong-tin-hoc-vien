import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { HopDongDotService } from './hop-dong-dot.service';

// Issue #67 / ADR 0015 O1, O2, O4, P2: danh sách hợp đồng của 1 đợt (STK cá nhân đã che) + Excel 3 sheet cho
// Phòng KHTC — chỉ Quản trị. Đăng ký TRƯỚC HopDongQuanTriController trong module: '/hop-dong/xuat-khtc' phải
// khớp ở đây trước khi rơi vào '/hop-dong/:donViId' (ParseUUIDPipe → 400).
@Roles('quan_tri')
@Controller('cong-don-vi/dot-trien-khai/:id/hop-dong')
export class HopDongDotController {
  constructor(private readonly service: HopDongDotService) {}

  @Get()
  danhSach(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.danhSach(id);
  }

  // Có STK cá nhân đầy đủ (sheet Chi hỗ trợ) → no-store; service ghi nhật ký mỗi lần xuất.
  @Get('xuat-khtc')
  async xuatKhtc(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { buffer, tenFile } = await this.service.xuatKhtc(id);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${tenFile}"`,
        'Cache-Control': 'no-store',
      })
      .send(buffer);
  }
}
