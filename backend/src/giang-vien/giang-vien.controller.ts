import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import { GiangVienService } from './giang-vien.service';
import { TaiKhoanGiangVienService } from './tai-khoan-giang-vien.service';
import {
  CreateGiangVienDto,
  LichDayQueryDto,
  QueryGiangVienDto,
  UpdateGiangVienDto,
  XacNhanGioDto,
} from './dto/giang-vien.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// T11 (issue #3) — docs/api-contract.md mục "Giảng viên & phân công". Dữ
// liệu cá nhân giảng viên → chỉ quan_tri. Không có DELETE (ngưng = PATCH
// trang_thai). Xác nhận giờ đặt dưới /giang-vien/phan-cong/... (không mở
// thêm tiền tố Nginx /phan-cong).
export class TrangThaiTaiKhoanGvDto {
  @IsIn(['active', 'ngung'])
  trang_thai!: 'active' | 'ngung';
}

@Roles('quan_tri')
@Controller('giang-vien')
export class GiangVienController {
  constructor(
    private readonly giangVienService: GiangVienService,
    private readonly taiKhoan: TaiKhoanGiangVienService,
  ) {}

  // ADR 0004 G8 (issue #20): tài khoản giảng viên — gửi link kích hoạt, khóa/mở.
  @Post(':id/gui-link-kich-hoat')
  @HttpCode(HttpStatus.OK)
  guiLinkKichHoat(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taiKhoan.guiLinkKichHoat(id, user);
  }

  @Patch(':id/tai-khoan')
  datTrangThaiTaiKhoan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TrangThaiTaiKhoanGvDto,
  ) {
    return this.taiKhoan.datTrangThai(id, dto.trang_thai);
  }

  @Get()
  findAll(@Query() query: QueryGiangVienDto) {
    return this.giangVienService.findAll(query);
  }

  @Post()
  create(
    @Body() dto: CreateGiangVienDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.giangVienService.create(dto, user);
  }

  @Patch('phan-cong/:id/xac-nhan-gio')
  xacNhanGio(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: XacNhanGioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.giangVienService.xacNhanGio(id, dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGiangVienDto,
  ) {
    return this.giangVienService.update(id, dto);
  }

  @Get(':id/lich-day')
  lichDay(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LichDayQueryDto,
  ) {
    return this.giangVienService.lichDay(id, query);
  }
}
