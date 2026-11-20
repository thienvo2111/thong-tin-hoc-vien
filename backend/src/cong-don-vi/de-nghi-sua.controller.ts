import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DeNghiSuaService } from './de-nghi-sua.service';
import { LocDeNghiDto } from './dto/de-nghi-sua.dto';
import { LyDoDto } from './dto/danh-sach-tham-gia.dto';

// Issue #62 / ADR 0015 X2: hàng đợi đề nghị sửa/thêm/bớt người của trường — chỉ Quản trị.
@Roles('quan_tri')
@Controller('cong-don-vi')
export class DeNghiSuaController {
  constructor(private readonly service: DeNghiSuaService) {}

  @Get('dot-trien-khai/:id/de-nghi')
  danhSach(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LocDeNghiDto,
  ) {
    return this.service.danhSach(id, query.trang_thai, query.don_vi_id);
  }

  @Post('de-nghi-sua/:id/ap-dung')
  @HttpCode(200)
  apDung(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.apDung(id, user.id);
  }

  // Lý do bắt buộc (1–500 ký tự) — cùng DTO với Quản trị xóa dòng.
  @Post('de-nghi-sua/:id/tu-choi')
  @HttpCode(200)
  tuChoi(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LyDoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.tuChoi(id, dto.ly_do, user.id);
  }
}
