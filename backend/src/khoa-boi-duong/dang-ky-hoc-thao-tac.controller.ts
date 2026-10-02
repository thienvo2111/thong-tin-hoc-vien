import {
  Body,
  Controller,
  Delete,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Put,
} from '@nestjs/common';
import { loai_lop_hoc } from '@prisma/client';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CapNhatLopDangKyDto } from './dto/capnhat-lop-dang-ky.dto';
import { CapNhatCumDangKyDto } from './dto/capnhat-cum-dang-ky.dto';
import { GanLopGiaiDoanDto } from './dto/gan-lop-giai-doan.dto';

// PATCH/DELETE /dang-ky-hoc/{id}/lop, PATCH /dang-ky-hoc/{id}/cum — QĐ10
// (mo-rong-nls-an-giang.md, 2026-09-30): thao tác thủ công từng đăng ký học
// một, chuẩn bị cho màn hình admin sửa tay (task frontend riêng sau).
// Controller riêng (không chung với DangKyHocKetQuaController) vì phạm vi
// quyền khác — ở đây chỉ Trường (chủ khóa) + Quản trị được thao tác, không
// có Phòng VHXH/Sở như PATCH ket-qua.
@Controller('dang-ky-hoc')
export class DangKyHocThaoTacController {
  constructor(private readonly khoaBoiDuongService: KhoaBoiDuongService) {}

  @Roles('truong', 'quan_tri')
  @Patch(':id/lop')
  capNhatLop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CapNhatLopDangKyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatLopDangKy(id, dto, user);
  }

  @Roles('truong', 'quan_tri')
  @Delete(':id/lop/:loaiLop')
  xoaLop(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('loaiLop', new ParseEnumPipe(loai_lop_hoc)) loaiLop: loai_lop_hoc,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.xoaLopDangKy(id, loaiLop, user);
  }

  @Roles('truong', 'quan_tri')
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
  @Roles('truong', 'quan_tri')
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
