import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { HoSoDonViService } from './ho-so-don-vi.service';

// Issue #63 / ADR 0015 M4, U2, O3: Hồ sơ đơn vị. Trường chỉ có endpoint KHÔNG nhận id
// (luôn là đơn vị trong token); Quản trị đọc theo id. Sở/Phòng không bao giờ thấy Phần 2/5 (O3).
@Controller('cong-don-vi/ho-so-don-vi')
export class HoSoDonViController {
  constructor(private readonly service: HoSoDonViService) {}

  @Roles('truong')
  @Get()
  cuaTruong(@CurrentUser() user: AuthenticatedUser) {
    return this.service.cuaTruong(user);
  }

  // Thân thô (không DTO): ValidationPipe toàn cục chỉ whitelist, khóa lạ phải trả 400 —
  // quy tắc thuần docDauVaoHoSo kiểm tra khóa + kiểu, dùng chung với kiểm tra định dạng.
  @Roles('truong')
  @Put()
  luu(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.service.luu(user, body);
  }

  @Roles('quan_tri')
  @Get(':donViId')
  quanTriXem(@Param('donViId', ParseUUIDPipe) donViId: string) {
    return this.service.quanTriXem(donViId);
  }
}
