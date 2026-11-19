import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TruongDanhSachService } from './truong-danh-sach.service';

// Issue #60 / ADR 0015 U1, X6, O3: trang chủ trường (thẻ đợt) + xem danh sách tham gia của chính trường.
// Sở/Phòng xem ở lát sau (#71) — hiện chỉ vai trò truong.
@Roles('truong')
@Controller('cong-don-vi/truong')
export class TruongDanhSachController {
  constructor(private readonly service: TruongDanhSachService) {}

  @Get('dot')
  dotCuaTruong(@CurrentUser() user: AuthenticatedUser) {
    return this.service.dotCuaTruong(user);
  }

  @Get('dot/:dotId/danh-sach')
  danhSach(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.danhSachCuaTruong(user, dotId);
  }
}
