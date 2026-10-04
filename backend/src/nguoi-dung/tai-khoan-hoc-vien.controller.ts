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
import { TaiKhoanHocVienService } from './tai-khoan-hoc-vien.service';
import {
  DoiTrangThaiTaiKhoanHocVienDto,
  QueryTaiKhoanHocVienDto,
} from './dto/tai-khoan-hoc-vien.dto';

// Tài khoản đăng nhập của học viên — chỉ quan_tri.
@Roles('quan_tri')
@Controller('nguoi-dung/hoc-vien')
export class TaiKhoanHocVienController {
  constructor(private readonly service: TaiKhoanHocVienService) {}

  @Get()
  danhSach(@Query() query: QueryTaiKhoanHocVienDto) {
    return this.service.danhSach(query);
  }

  @Patch(':id')
  doiTrangThai(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DoiTrangThaiTaiKhoanHocVienDto,
  ) {
    return this.service.doiTrangThai(id, dto);
  }

  @Post(':id/mo-khoa-tam')
  @HttpCode(HttpStatus.OK)
  moKhoaTam(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.moKhoaTam(id);
  }
}
