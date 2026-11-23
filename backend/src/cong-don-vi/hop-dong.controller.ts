import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { HopDongService } from './hop-dong.service';
import { LyDoDto } from './dto/danh-sach-tham-gia.dto';
import { HanRiengDto } from './dto/han-rieng.dto';

// Issue #64 / ADR 0015 M5, X4, X5: trường xem / lưu nháp Phần 3–4 / Nộp hợp đồng của CHÍNH MÌNH (đơn vị
// trong token). Sở/Phòng xem trạng thái ở lát sau (#71) — hiện chỉ vai trò truong.
@Roles('truong')
@Controller('cong-don-vi/truong/dot/:dotId/hop-dong')
export class HopDongTruongController {
  constructor(private readonly service: HopDongService) {}

  @Get()
  xem(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cuaTruong(user, dotId);
  }

  // Thân thô (không DTO): ValidationPipe toàn cục chỉ whitelist, khóa lạ phải trả 400 —
  // quy tắc thuần docDauVaoHopDong kiểm khóa + kiểu (cùng cách PUT hồ sơ đơn vị).
  @Put()
  luuNhap(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.luuNhap(user, dotId, body);
  }

  @Post('nop')
  @HttpCode(200)
  nop(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.nop(user, dotId);
  }
}

// Issue #64 / ADR 0015 O3, O4, X5: Quản trị xem hợp đồng của 1 trường (đủ giá trị — giao diện che STK Phần 5)
// và Mở lại hợp đồng đã nộp (bắt buộc lý do). Issue #66 / T3: gia hạn riêng 1 trường (bắt buộc lý do).
@Roles('quan_tri')
@Controller('cong-don-vi/dot-trien-khai/:dotId/hop-dong/:donViId')
export class HopDongQuanTriController {
  constructor(private readonly service: HopDongService) {}

  @Get()
  xem(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @Param('donViId', ParseUUIDPipe) donViId: string,
  ) {
    return this.service.quanTriXem(dotId, donViId);
  }

  @Post('mo-lai')
  @HttpCode(200)
  moLai(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @Param('donViId', ParseUUIDPipe) donViId: string,
    @Body() dto: LyDoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.moLai(user.id, dotId, donViId, dto.ly_do);
  }

  @Put('han-rieng')
  datHanRieng(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @Param('donViId', ParseUUIDPipe) donViId: string,
    @Body() dto: HanRiengDto,
  ) {
    return this.service.datHanRieng(dotId, donViId, dto.han_rieng, dto.ly_do);
  }
}
