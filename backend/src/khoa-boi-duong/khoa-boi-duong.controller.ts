import {
  Body,
  Controller,
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
import { CreateLopHocDto } from './dto/create-lop-hoc.dto';

// Dịch vụ Khóa bồi dưỡng & Lớp học — docs/api-contract.md mục 3.
@Controller('khoa-boi-duong')
export class KhoaBoiDuongController {
  constructor(private readonly khoaBoiDuongService: KhoaBoiDuongService) {}

  @Roles('truong')
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

  @Roles('truong', 'quan_tri')
  @Post(':id/lop')
  themLop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLopHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themLop(id, dto, user);
  }
}
