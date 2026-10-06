import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { IsOptional, Matches } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CongGiangVienService } from './cong-giang-vien.service';

const NGAY = /^\d{4}-\d{2}-\d{2}$/;

export class LichDayCuaToiQueryDto {
  @IsOptional()
  @Matches(NGAY, { message: 'Định dạng YYYY-MM-DD' })
  tu_ngay?: string;

  @IsOptional()
  @Matches(NGAY, { message: 'Định dạng YYYY-MM-DD' })
  den_ngay?: string;
}

// ADR 0004 G8 (issue #20): API cổng giảng viên — tiền tố /cong-giang-vien
// (trang frontend ở /giang-day; /giang-vien là API danh mục của Quản trị).
// Chỉ GET: mọi thao tác ghi của giảng viên đều không có route (K17).
@Roles('giang_vien')
@Controller('cong-giang-vien')
export class CongGiangVienController {
  constructor(private readonly service: CongGiangVienService) {}

  @Get('lich-day')
  lichDay(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LichDayCuaToiQueryDto,
  ) {
    return this.service.lichDay(user.id, query);
  }

  @Get('lop/:lopId/giai-doan/:gdId')
  trangLop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Param('gdId', ParseUUIDPipe) gdId: string,
  ) {
    return this.service.trangLop(user.id, lopId, gdId);
  }
}
