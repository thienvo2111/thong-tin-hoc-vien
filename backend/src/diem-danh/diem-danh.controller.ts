import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DiemDanhService } from './diem-danh.service';
import { BangDiemDanhQueryDto, SuaDiemDanhDto } from './diem-danh.dto';

// ADR 0005 Z7 (issue #26): bảng điểm danh của lớp + sửa nhanh 1 ô. Dùng tiền
// tố /lop sẵn có (Nginx đã proxy). Giảng viên chỉ đọc (G8), hỗ trợ HV chỉ báo
// vắng (G13) -> không có vai trò ở đây.
@Roles('quan_tri', 'ho_tro_giang_vien')
@Controller('lop')
export class DiemDanhController {
  constructor(private readonly diemDanh: DiemDanhService) {}

  @Get(':lopId/diem-danh')
  bang(
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Query() query: BangDiemDanhQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.diemDanh.bangDiemDanh(user, lopId, query.giai_doan_id);
  }

  @Put(':lopId/diem-danh')
  sua(
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Body() dto: SuaDiemDanhDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.diemDanh.suaO(user, lopId, dto);
  }
}
