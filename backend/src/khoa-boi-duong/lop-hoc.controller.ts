import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateLichHocDto } from './dto/create-lich-hoc.dto';
import { CreateNhanSuDto } from './dto/create-nhan-su.dto';

// docs/api-contract.md mục 3 — route riêng /lop/{id}/... (không nằm dưới
// /khoa-boi-duong vì thao tác trực tiếp trên lop_id, không cần khoa_id trên URL).
@Controller('lop')
export class LopHocController {
  constructor(private readonly khoaBoiDuongService: KhoaBoiDuongService) {}

  @Roles('truong', 'quan_tri')
  @Post(':id/lich-hoc')
  themLichHoc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLichHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themLichHoc(id, dto, user);
  }

  @Roles('truong', 'quan_tri')
  @Post(':id/nhan-su')
  themNhanSu(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNhanSuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.themNhanSu(id, dto, user);
  }

  @Roles('truong', 'quan_tri')
  @Delete(':id/nhan-su/:nhanSuId')
  xoaNhanSu(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.xoaNhanSu(id, nhanSuId, user);
  }
}
