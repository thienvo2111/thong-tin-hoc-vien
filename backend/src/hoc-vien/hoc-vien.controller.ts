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
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { HocVienService } from './hoc-vien.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateHocVienDto } from './dto/create-hoc-vien.dto';
import { UpdateHocVienDto } from './dto/update-hoc-vien.dto';
import { QueryHocVienDto } from './dto/query-hoc-vien.dto';
import { DuyetHocVienDto } from './dto/duyet-hoc-vien.dto';
import { ChuyenMonDto } from './dto/chuyen-mon.dto';
import { KiemTraTrungQueryDto } from './dto/kiem-tra-trung-query.dto';
import { SuaMaMoetDto } from './dto/sua-ma-moet.dto';

// Dịch vụ Học viên — docs/api-contract.md mục 2.
@Controller('hoc-vien')
export class HocVienController {
  constructor(private readonly hocVienService: HocVienService) {}

  @Public()
  @Post()
  dangKy(@Body() dto: CreateHocVienDto) {
    return this.hocVienService.dangKy(dto);
  }

  // T1: giới hạn 10 request/phút/IP — xem ghi chú ở AuthController.dangNhap.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Get('kiem-tra-trung')
  kiemTraTrung(@Query() query: KiemTraTrungQueryDto) {
    return this.hocVienService.kiemTraTrung(query.so_dinh_danh_ca_nhan);
  }

  // T9: cổng học viên xem danh sách còn thiếu để hồ sơ được coi là "đầy đủ".
  @Roles('hoc_vien')
  @Get('toi/muc-do-day-du')
  mucDoDayDu(@CurrentUser() user: AuthenticatedUser) {
    return this.hocVienService.mucDoDayDuCuaToi(user);
  }

  // T14: cổng học viên xem đợt xác nhận đang mở/sắp mở + trạng thái xác nhận.
  @Roles('hoc_vien')
  @Get('toi/dot-xac-nhan')
  dotXacNhanCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.hocVienService.dotXacNhanCuaToi(user);
  }

  // T15: cổng điều kiện làm đánh giá đầu vào (QĐ8/QĐ9) — trả link + tài
  // khoản VLE nếu đủ điều kiện, không thì lý do (hoặc het_han nếu đợt 2 đã
  // đóng mà chưa đủ).
  @Roles('hoc_vien')
  @Get('toi/danh-gia-dau-vao')
  danhGiaDauVaoCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.hocVienService.danhGiaDauVaoCuaToi(user);
  }

  @Roles('hoc_vien')
  @Get('toi')
  layHoSoCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.hocVienService.layHoSoCuaToi(user);
  }

  @Roles('hoc_vien')
  @Patch('toi')
  capNhatHoSoCuaToi(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateHocVienDto,
  ) {
    return this.hocVienService.capNhatHoSoCuaToi(user, dto);
  }

  @Roles('hoc_vien')
  @Post('toi/chuyen-mon')
  themChuyenMon(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChuyenMonDto,
  ) {
    return this.hocVienService.themChuyenMon(user, dto);
  }

  @Roles('hoc_vien')
  @Delete('toi/chuyen-mon')
  xoaChuyenMon(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChuyenMonDto,
  ) {
    return this.hocVienService.xoaChuyenMon(user, dto);
  }

  @Roles('hoc_vien')
  @Post('toi/kiem-tra-truoc-xac-nhan')
  kiemTraTruocXacNhan(@CurrentUser() user: AuthenticatedUser) {
    return this.hocVienService.kiemTraTruocXacNhan(user);
  }

  // 2026-09-30: gửi lại email xác minh cho email_lien_he hiện tại.
  @Roles('hoc_vien')
  @Post('toi/gui-lai-xac-minh-email')
  guiLaiXacMinhEmail(@CurrentUser() user: AuthenticatedUser) {
    return this.hocVienService.guiLaiXacMinhEmail(user);
  }

  @Roles('hoc_vien')
  @Post('toi/xac-nhan')
  xacNhan(@CurrentUser() user: AuthenticatedUser) {
    return this.hocVienService.xacNhan(user);
  }

  @Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri')
  @Get()
  findAll(
    @Query() query: QueryHocVienDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hocVienService.findAll(query, user);
  }

  @Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri')
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hocVienService.findOne(id, user);
  }

  @Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri')
  @Post(':id/duyet')
  duyet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuyetHocVienDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hocVienService.duyet(id, dto, user);
  }

  // Spec 2026-10-09 Q-E: quan_tri sửa mã định danh MOET (bắt buộc lý do).
  // Khác số đoạn với PATCH ':id' nên không tranh route.
  @Roles('quan_tri')
  @Patch(':id/ma-dinh-danh-moet')
  suaMaDinhDanhMoet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuaMaMoetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hocVienService.suaMaDinhDanhMoet(id, dto, user);
  }

  // T14: quan_tri sửa hồ sơ import_moet NGOÀI thời gian đợt xác nhận (học
  // viên chỉ xem lúc đó) — ghi lịch sử với vai_tro_nguoi_sua='quan_tri'.
  @Roles('quan_tri')
  @Patch(':id')
  suaHoSoByAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHocVienDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hocVienService.suaHoSoByAdmin(id, dto, user);
  }
}
