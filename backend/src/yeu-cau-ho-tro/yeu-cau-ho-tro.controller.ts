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
import { YeuCauHoTroService } from './yeu-cau-ho-tro.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TaoYeuCauHoTroDto } from './dto/tao-yeu-cau-ho-tro.dto';
import { TraLoiYeuCauHoTroDto } from './dto/tra-loi-yeu-cau-ho-tro.dto';
import { DanhGiaYeuCauHoTroDto } from './dto/danh-gia-yeu-cau-ho-tro.dto';
import { QueryYeuCauHoTroDto } from './dto/query-yeu-cau-ho-tro.dto';

// Dịch vụ Yêu cầu hỗ trợ (M8) — ticket không-real-time, thay thế ý tưởng
// "chat AI" (quyết định grill-me 2026-10-01). Chỉ hoc_vien tạo; quan_tri xử lý ở
// đây, người hỗ trợ học viên xử lý theo cụm ở HoTroYeuCauHoTroController (ADR 0003).
@Controller('yeu-cau-ho-tro')
export class YeuCauHoTroController {
  constructor(private readonly service: YeuCauHoTroService) {}

  @Roles('hoc_vien')
  @Post('toi')
  taoCuaToi(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TaoYeuCauHoTroDto,
  ) {
    return this.service.taoCuaToi(user.hoc_vien_id as string, dto);
  }

  @Roles('hoc_vien')
  @Get('toi')
  danhSachCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.service.danhSachCuaToi(user.hoc_vien_id as string);
  }

  @Roles('hoc_vien')
  @Get('toi/:id')
  chiTietCuaToi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.chiTietCuaToi(user.hoc_vien_id as string, id);
  }

  @Roles('hoc_vien')
  @Post('toi/:id/dong')
  dongCuaToi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.dongCuaToi(user.hoc_vien_id as string, id);
  }

  @Roles('hoc_vien')
  @Post('toi/:id/danh-gia')
  danhGiaCuaToi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DanhGiaYeuCauHoTroDto,
  ) {
    return this.service.danhGiaCuaToi(user.hoc_vien_id as string, id, dto);
  }

  @Roles('quan_tri')
  @Get()
  danhSachQuanTri(@Query() query: QueryYeuCauHoTroDto) {
    return this.service.danhSachQuanTri(query);
  }

  @Roles('quan_tri')
  @Get(':id')
  chiTietQuanTri(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.chiTietQuanTri(id);
  }

  @Roles('quan_tri')
  @Patch(':id/tra-loi')
  traLoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TraLoiYeuCauHoTroDto,
  ) {
    return this.service.traLoi(id, user.id, dto);
  }

  // ADR 0003 H12: chỉ Quản trị đính chính câu trả lời (báo email học viên).
  @Roles('quan_tri')
  @Patch(':id/sua-tra-loi')
  suaTraLoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TraLoiYeuCauHoTroDto,
  ) {
    return this.service.suaTraLoi(id, user.id, dto);
  }
}
