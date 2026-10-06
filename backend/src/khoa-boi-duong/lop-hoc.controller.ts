import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateLichHocDto } from './dto/create-lich-hoc.dto';
import { UpdateLichHocDto } from './dto/update-lich-hoc.dto';
import { CreateNhanSuDto } from './dto/create-nhan-su.dto';
import { PhanCongBuoiDto } from '../giang-vien/dto/giang-vien.dto';
import { PhanCongGiangDayService } from '../giang-vien/phan-cong-giang-day.service';

// docs/api-contract.md mục 3 — route riêng /lop/{id}/... (không nằm dưới
// /khoa-boi-duong vì thao tác trực tiếp trên lop_id, không cần khoa_id trên URL).
@Controller('lop')
export class LopHocController {
  constructor(
    private readonly khoaBoiDuongService: KhoaBoiDuongService,
    private readonly phanCongGiangDay: PhanCongGiangDayService,
  ) {}

  // T11 (issue #3): thay toàn bộ phân công giảng viên của 1 buổi — luật dùng
  // chung với import (PhanCongGiangDayService): trùng giờ → 400, gỡ/đổi giờ
  // phân công đã xác nhận → 409.
  @Roles('quan_tri')
  @Put(':id/lich-hoc/:lichHocId/giang-vien')
  async phanCongGiangVien(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lichHocId', ParseUUIDPipe) lichHocId: string,
    @Body() dto: PhanCongBuoiDto,
  ) {
    await this.khoaBoiDuongService.layLichHocTrongLop(id, lichHocId);
    return this.phanCongGiangDay.thayPhanCongBuoi(lichHocId, dto.phan_cong);
  }

  @Roles('quan_tri')
  @Post(':id/lich-hoc')
  themLichHoc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLichHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themLichHoc(id, dto, user);
  }

  // Thêm 2026-09-30: sửa 1 phần lịch học (buổi) đã tạo.
  @Roles('quan_tri')
  @Patch(':id/lich-hoc/:lichHocId')
  capNhatLichHoc(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lichHocId', ParseUUIDPipe) lichHocId: string,
    @Body() dto: UpdateLichHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatLichHoc(id, lichHocId, dto, user);
  }

  @Roles('quan_tri')
  @Post(':id/nhan-su')
  themNhanSu(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNhanSuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themNhanSu(id, dto, user);
  }

  @Roles('quan_tri')
  @Delete(':id/nhan-su/:nhanSuId')
  xoaNhanSu(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.xoaNhanSu(id, nhanSuId, user);
  }
}
