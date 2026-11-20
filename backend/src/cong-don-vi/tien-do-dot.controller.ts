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
import { TienDoDotService } from './tien-do-dot.service';
import { LocTienDoDto } from './dto/tien-do-dot.dto';

// Issue #65 / ADR 0015 X7, T5, P2: bảng Tiến độ đợt + Excel trường chưa xong — chỉ Quản trị.
@Roles('quan_tri')
@Controller('cong-don-vi/dot-trien-khai/:id/tien-do')
export class TienDoDotController {
  constructor(private readonly service: TienDoDotService) {}

  @Get()
  layTienDo(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LocTienDoDto,
  ) {
    return this.service.layTienDo(id, query.loc);
  }

  // Có người liên hệ + SĐT + email (dữ liệu cá nhân) → no-store; service ghi nhật ký.
  @Get('xuat-excel')
  async xuatExcel(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LocTienDoDto,
    @Res() res: Response,
  ) {
    const { buffer, tenFile } = await this.service.xuatExcel(id, query.loc);
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
