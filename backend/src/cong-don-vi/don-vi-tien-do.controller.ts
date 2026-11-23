import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DonViTienDoService } from './don-vi-tien-do.service';
import { LocTienDoDto } from './dto/tien-do-dot.dto';

// Issue #71 / ADR 0015 P1, O3: Sở/Phòng xem tiến độ các trường trong phạm vi + danh sách GV (chỉ đọc).
// Trường/Quản trị/học viên → 403. Phạm vi lấy từ token, không nhận đơn vị gốc từ client.
@Roles('so_gddt', 'phong_vhxh')
@Controller('cong-don-vi/don-vi')
export class DonViTienDoController {
  constructor(private readonly service: DonViTienDoService) {}

  @Get('dot')
  dsDot(@CurrentUser() user: AuthenticatedUser) {
    return this.service.dsDot(user);
  }

  @Get('dot/:dotId/tien-do')
  tienDo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @Query() query: LocTienDoDto,
  ) {
    return this.service.tienDoDot(user, dotId, query.loc);
  }

  @Get('dot/:dotId/truong/:donViId/danh-sach')
  danhSach(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @Param('donViId', ParseUUIDPipe) donViId: string,
  ) {
    return this.service.danhSachTruong(user, dotId, donViId);
  }
}
