import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// GET /hoc-vien/{id}/khoa-hoc — Thêm 2026-09-30 (QĐ10, docs/api-contract.md
// mục 3): admin/Trường/Sở/Phòng xem lại khóa/lớp của 1 học viên cụ thể,
// chuẩn bị đổi lớp/cụm qua DangKyHocThaoTacController. Controller riêng
// (không đặt vào HocVienController) vì logic đọc dữ liệu giống hệt
// KhoaBoiDuongService.khoaHocCuaToi — HocVienModule chủ động không phụ
// thuộc KhoaBoiDuongModule (xem hoc-vien.module.ts), nên đặt route ở đây
// tránh vòng lặp phụ thuộc module.
@Controller('hoc-vien')
export class HocVienKhoaHocController {
  constructor(private readonly khoaBoiDuongService: KhoaBoiDuongService) {}

  @Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri')
  @Get(':id/khoa-hoc')
  khoaHocCuaHocVien(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.khoaHocCuaHocVien(id, user);
  }
}
