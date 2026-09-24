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

// Dịch vụ Học viên — docs/api-contract.md mục 2.
@Controller('hoc-vien')
export class HocVienController {
  constructor(private readonly hocVienService: HocVienService) {}

  @Public()
  @Post()
  dangKy(@Body() dto: CreateHocVienDto) {
    return this.hocVienService.dangKy(dto);
  }

  @Public()
  @Get('kiem-tra-trung')
  kiemTraTrung(@Query() query: KiemTraTrungQueryDto) {
    return this.hocVienService.kiemTraTrung(query.so_dinh_danh_ca_nhan);
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
}
