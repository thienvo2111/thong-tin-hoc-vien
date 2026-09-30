import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateKhoaBoiDuongDto } from './dto/create-khoa-boi-duong.dto';
import { UpdateKhoaBoiDuongDto } from './dto/update-khoa-boi-duong.dto';
import { QueryKhoaBoiDuongDto } from './dto/query-khoa-boi-duong.dto';
import { DuyetKhoaDto } from './dto/duyet-khoa.dto';
import { CreateGiaiDoanDto } from './dto/create-giai-doan.dto';
import { UpdateGiaiDoanDto } from './dto/update-giai-doan.dto';
import { CreateLopHocDto } from './dto/create-lop-hoc.dto';
import { UpdateLopHocDto } from './dto/update-lop-hoc.dto';
import { ThemDonViTheoDoiDto } from './dto/them-don-vi-theo-doi.dto';
import { CreateCumHocVienDto } from './dto/create-cum-hoc-vien.dto';
import { UpdateCumHocVienDto } from './dto/update-cum-hoc-vien.dto';

// Dịch vụ Khóa bồi dưỡng & Lớp học — docs/api-contract.md mục 3.
@Controller('khoa-boi-duong')
export class KhoaBoiDuongController {
  constructor(private readonly khoaBoiDuongService: KhoaBoiDuongService) {}

  // T2 (QĐ2): quan_tri tạo khóa cho đơn vị loại 'khac'/'truong' (vd. HCMUE),
  // tự duyệt ngay — xem KhoaBoiDuongService.taoKhoa.
  @Roles('truong', 'quan_tri')
  @Post()
  taoKhoa(
    @Body() dto: CreateKhoaBoiDuongDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.taoKhoa(dto, user);
  }

  @Roles('truong', 'quan_tri')
  @Patch(':id')
  capNhatKhoa(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKhoaBoiDuongDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatKhoa(id, dto, user);
  }

  @Roles('truong', 'quan_tri')
  @Post(':id/nop-duyet')
  nopDuyet(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.nopDuyet(id, user);
  }

  @Roles('phong_vhxh', 'so_gddt', 'quan_tri')
  @Post(':id/duyet')
  duyet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuyetKhoaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.duyet(id, dto, user);
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

  @Roles('truong', 'quan_tri')
  @Post(':id/giai-doan')
  themGiaiDoan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateGiaiDoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themGiaiDoan(id, dto, user);
  }

  // Thêm 2026-09-30: sửa 1 phần giai đoạn đã tạo.
  @Roles('truong', 'quan_tri')
  @Patch(':id/giai-doan/:giaiDoanId')
  capNhatGiaiDoan(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('giaiDoanId', ParseUUIDPipe) giaiDoanId: string,
    @Body() dto: UpdateGiaiDoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatGiaiDoan(id, giaiDoanId, dto, user);
  }

  @Roles('truong', 'quan_tri')
  @Post(':id/lop')
  themLop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLopHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themLop(id, dto, user);
  }

  // Thêm 2026-09-30: sửa 1 phần lớp học đã tạo (vd gõ nhầm tên, sửa sĩ số).
  @Roles('truong', 'quan_tri')
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
  @Roles('truong', 'quan_tri')
  @Post(':id/cum')
  themCum(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCumHocVienDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themCum(id, dto, user);
  }

  // Thêm 2026-09-30: sửa 1 phần cụm học viên đã tạo.
  @Roles('truong', 'quan_tri')
  @Patch(':id/cum/:cumId')
  capNhatCum(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cumId', ParseUUIDPipe) cumId: string,
    @Body() dto: UpdateCumHocVienDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatCum(id, cumId, dto, user);
  }

  // T2 (QĐ2): danh sách đơn vị "theo dõi" khóa — chỉ quan_tri quản lý được
  // (Sở/Phòng/Trường chỉ được XEM khóa qua danh sách này, không tự thêm/bớt
  // mình vào — xem KhoaBoiDuongService.themDonViTheoDoi/xoaDonViTheoDoi).
  @Roles('quan_tri')
  @Post(':id/don-vi-theo-doi')
  themDonViTheoDoi(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ThemDonViTheoDoiDto,
  ) {
    return this.khoaBoiDuongService.themDonViTheoDoi(id, dto);
  }

  @Roles('quan_tri')
  @Delete(':id/don-vi-theo-doi/:donViId')
  xoaDonViTheoDoi(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('donViId', ParseUUIDPipe) donViId: string,
  ) {
    return this.khoaBoiDuongService.xoaDonViTheoDoi(id, donViId);
  }
}
