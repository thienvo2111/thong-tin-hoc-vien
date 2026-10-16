import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  DuyetDoiBuoiDto,
  GhiChuXuLyDto,
  LocDoiBuoiDto,
} from './dto/doi-buoi-hoc.dto';
import { DoiBuoiHocService } from './doi-buoi-hoc.service';

// Người duyệt đề nghị đổi buổi (spec §3.2). ho_tro_hoc_vien chỉ thấy cụm của mình.
@Controller('doi-buoi-hoc')
@Roles('quan_tri', 'ho_tro_hoc_vien')
export class DoiBuoiHocController {
  constructor(private readonly service: DoiBuoiHocService) {}

  @Get()
  danhSach(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LocDoiBuoiDto,
  ) {
    return this.service.danhSach(user, query);
  }

  @Get('dem-cho-duyet')
  demChoDuyet(@CurrentUser() user: AuthenticatedUser) {
    return this.service.demChoDuyet(user);
  }

  @Get(':id/lua-chon')
  luaChon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.luaChonDuyet(user, id);
  }

  @Post(':id/duyet')
  @HttpCode(HttpStatus.OK)
  duyet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuyetDoiBuoiDto,
  ) {
    return this.service.duyet(user, id, dto);
  }

  @Post(':id/tu-choi')
  @HttpCode(HttpStatus.OK)
  tuChoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GhiChuXuLyDto,
  ) {
    return this.service.tuChoi(user, id, dto);
  }

  @Post(':id/huy-duyet')
  @HttpCode(HttpStatus.OK)
  huyDuyet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GhiChuXuLyDto,
  ) {
    return this.service.huyDuyet(user, id, dto);
  }
}
