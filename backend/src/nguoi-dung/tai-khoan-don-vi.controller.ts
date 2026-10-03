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
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TaiKhoanDonViService } from './tai-khoan-don-vi.service';
import {
  QueryDonViChuaCapDto,
  QueryTaiKhoanDonViDto,
  SuaTaiKhoanDonViDto,
  TaoTaiKhoanDonViDto,
} from './dto/tai-khoan-don-vi.dto';

// Tài khoản đơn vị (ADR 0002) — chỉ quan_tri.
@Roles('quan_tri')
@Controller('nguoi-dung/don-vi')
export class TaiKhoanDonViController {
  constructor(private readonly service: TaiKhoanDonViService) {}

  @Get()
  danhSach(@Query() query: QueryTaiKhoanDonViDto) {
    return this.service.danhSach(query);
  }

  @Get('chua-cap')
  donViChuaCap(@Query() query: QueryDonViChuaCapDto) {
    return this.service.donViChuaCap(query);
  }

  @Post()
  tao(@Body() dto: TaoTaiKhoanDonViDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.taoTaiKhoan(dto, user);
  }

  @Patch(':id')
  sua(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SuaTaiKhoanDonViDto) {
    return this.service.sua(id, dto);
  }

  @Post(':id/cap-mat-khau-tam')
  @HttpCode(HttpStatus.OK)
  capMatKhauTam(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.capMatKhauTam(id, user);
  }

  @Post(':id/gui-email-kich-hoat')
  @HttpCode(HttpStatus.OK)
  guiEmailKichHoat(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.guiEmailKichHoat(id, user);
  }
}
