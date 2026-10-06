import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateKhoaBoiDuongDto } from './dto/create-khoa-boi-duong.dto';
import { UpdateKhoaBoiDuongDto } from './dto/update-khoa-boi-duong.dto';
import { QueryKhoaBoiDuongDto } from './dto/query-khoa-boi-duong.dto';
import { CreateGiaiDoanDto } from './dto/create-giai-doan.dto';
import { UpdateGiaiDoanDto } from './dto/update-giai-doan.dto';
import { CreateLopHocDto } from './dto/create-lop-hoc.dto';
import { UpdateLopHocDto } from './dto/update-lop-hoc.dto';
import { CreateCumHocVienDto } from './dto/create-cum-hoc-vien.dto';
import { UpdateCumHocVienDto } from './dto/update-cum-hoc-vien.dto';
import { GanNguoiHoTroCumDto } from './dto/gan-nguoi-ho-tro-cum.dto';

// Dịch vụ Khóa bồi dưỡng & Lớp học — docs/api-contract.md mục 3. D1/D6
// (2026-10-03-don-vi-dat-hang): mọi endpoint ghi chỉ quan_tri — đã bỏ luồng
// nộp duyệt/duyệt khóa và danh sách đơn vị theo dõi (xem spec mục 4).
@Controller('khoa-boi-duong')
export class KhoaBoiDuongController {
  constructor(private readonly khoaBoiDuongService: KhoaBoiDuongService) {}

  @Roles('quan_tri')
  @Post()
  taoKhoa(
    @Body() dto: CreateKhoaBoiDuongDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.taoKhoa(dto, user);
  }

  @Roles('quan_tri')
  @Patch(':id')
  capNhatKhoa(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKhoaBoiDuongDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatKhoa(id, dto, user);
  }

  @Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri', 'hoc_vien')
  @Get()
  findAll(
    @Query() query: QueryKhoaBoiDuongDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.findAll(query, user);
  }

  @Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri', 'hoc_vien')
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.findOne(id, user);
  }

  @Roles('quan_tri')
  @Post(':id/giai-doan')
  themGiaiDoan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateGiaiDoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themGiaiDoan(id, dto, user);
  }

  // Thêm 2026-09-30: sửa 1 phần giai đoạn đã tạo.
  @Roles('quan_tri')
  @Patch(':id/giai-doan/:giaiDoanId')
  capNhatGiaiDoan(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('giaiDoanId', ParseUUIDPipe) giaiDoanId: string,
    @Body() dto: UpdateGiaiDoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatGiaiDoan(id, giaiDoanId, dto, user);
  }

  @Roles('quan_tri')
  @Post(':id/lop')
  themLop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLopHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themLop(id, dto, user);
  }

  // Thêm 2026-09-30: sửa 1 phần lớp học đã tạo (vd gõ nhầm tên, sửa sĩ số).
  @Roles('quan_tri')
  @Patch(':id/lop/:lopId')
  capNhatLop(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Body() dto: UpdateLopHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatLop(id, lopId, dto, user);
  }

  // QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30): cụm học viên — cùng quyền
  // thao tác với themLop.
  @Roles('quan_tri')
  @Post(':id/cum')
  themCum(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCumHocVienDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themCum(id, dto, user);
  }

  // Thêm 2026-09-30: sửa 1 phần cụm học viên đã tạo.
  @Roles('quan_tri')
  @Patch(':id/cum/:cumId')
  capNhatCum(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cumId', ParseUUIDPipe) cumId: string,
    @Body() dto: UpdateCumHocVienDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatCum(id, cumId, dto, user);
  }

  // ADR 0003 (2026-10-06): phân công người hỗ trợ học viên cho cụm.
  @Roles('quan_tri')
  @Put(':id/cum/:cumId/nguoi-ho-tro')
  ganNguoiHoTroCum(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cumId', ParseUUIDPipe) cumId: string,
    @Body() dto: GanNguoiHoTroCumDto,
  ) {
    return this.khoaBoiDuongService.ganNguoiHoTroCum(
      id,
      cumId,
      dto.nguoi_dung_ids,
    );
  }

  // ADR 0004 G3 (issue #14): nhóm người hỗ trợ giảng viên của khóa.
  @Roles('quan_tri')
  @Put(':id/nhom-ho-tro-gv')
  ganNhomHoTroGv(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GanNguoiHoTroCumDto,
  ) {
    return this.khoaBoiDuongService.ganNhomHoTroGv(id, dto.nguoi_dung_ids);
  }
}
