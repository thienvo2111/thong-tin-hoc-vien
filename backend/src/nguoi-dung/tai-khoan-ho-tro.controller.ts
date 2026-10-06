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
import { TaiKhoanHoTroService } from './tai-khoan-ho-tro.service';
import {
  QueryTaiKhoanHoTroDto,
  SuaTaiKhoanHoTroDto,
  TaoTaiKhoanHoTroDto,
} from './dto/tai-khoan-ho-tro.dto';

// Người hỗ trợ học viên (ADR 0003) — chỉ quan_tri.
@Roles('quan_tri')
@Controller('nguoi-dung/ho-tro')
export class TaiKhoanHoTroController {
  constructor(private readonly service: TaiKhoanHoTroService) {}

  @Get()
  danhSach(@Query() query: QueryTaiKhoanHoTroDto) {
    return this.service.danhSach(query);
  }

  @Post()
  tao(
    @Body() dto: TaoTaiKhoanHoTroDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.taoTaiKhoan(dto, user);
  }

  @Patch(':id')
  sua(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuaTaiKhoanHoTroDto,
  ) {
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
