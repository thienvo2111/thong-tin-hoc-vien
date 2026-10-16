import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { GuiDoiBuoiDto } from './dto/doi-buoi-hoc.dto';
import { DoiBuoiHocService } from './doi-buoi-hoc.service';

// Dùng chung prefix 'hoc-vien/toi' với DangKyHocController (chấp nhận được).
// GET lua-chon/:id và GET (gốc) không đụng PUT/POST :id.
@Controller('hoc-vien/toi/doi-buoi')
export class DoiBuoiHocHocVienController {
  constructor(private readonly service: DoiBuoiHocService) {}

  @Roles('hoc_vien')
  @Get()
  tongQuan(
    @CurrentUser() user: AuthenticatedUser,
    @Query('khoa_id', ParseUUIDPipe) khoaId: string,
  ) {
    return this.service.tongQuanHocVien(user, khoaId);
  }

  @Roles('hoc_vien')
  @Get('lua-chon/:lichNguonId')
  luaChon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lichNguonId', ParseUUIDPipe) lichNguonId: string,
  ) {
    return this.service.luaChonHocVien(user, lichNguonId);
  }

  @Roles('hoc_vien')
  @Post()
  gui(@CurrentUser() user: AuthenticatedUser, @Body() dto: GuiDoiBuoiDto) {
    return this.service.gui(user, dto);
  }

  @Roles('hoc_vien')
  @Put(':id')
  sua(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GuiDoiBuoiDto,
  ) {
    return this.service.sua(user, id, dto);
  }

  @Roles('hoc_vien')
  @Post(':id/huy')
  huy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.huyHocVien(user, id);
  }
}
