import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
} from '@nestjs/common';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CapNhatCumDangKyDto } from './dto/capnhat-cum-dang-ky.dto';
import { GanLopGiaiDoanDto } from './dto/gan-lop-giai-doan.dto';

// PUT /dang-ky-hoc/{id}/giai-doan/{giaiDoanId}/lop (phân lớp theo giai đoạn,
// spec 2026-10-02), PATCH /dang-ky-hoc/{id}/cum — thao tác thủ công từng đăng
// ký học một ở màn admin chi tiết học viên. D6 (2026-10-03-don-vi-dat-hang):
// chỉ quan_tri thao tác.
@Controller('dang-ky-hoc')
export class DangKyHocThaoTacController {
  constructor(private readonly khoaBoiDuongService: KhoaBoiDuongService) {}

  @Roles('quan_tri')
  @Patch(':id/cum')
  capNhatCum(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CapNhatCumDangKyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatCumDangKy(id, dto, user);
  }

  // Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.3): gán/thay/gỡ lớp của 1
  // giai đoạn; lop_id null = gỡ.
  @Roles('quan_tri')
  @Put(':id/giai-doan/:giaiDoanId/lop')
  ganLopGiaiDoan(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('giaiDoanId', ParseUUIDPipe) giaiDoanId: string,
    @Body() dto: GanLopGiaiDoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.ganLopGiaiDoan(
      id,
      giaiDoanId,
      dto.lop_id,
      user,
    );
  }
}
