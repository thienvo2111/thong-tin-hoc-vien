import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ToiChuongTrinhService } from './toi-chuong-trinh.service';

// Issue #70 / ADR 0015 P1: đơn vị (trường/Phòng/Sở) hỏi mình đang tham gia chương trình nào
// để Cổng đơn vị hiện nhóm menu tương ứng. Quản trị dùng boiduongnls nên không gọi.
@Roles('truong', 'phong_vhxh', 'so_gddt')
@Controller('cong-don-vi/toi')
export class ToiChuongTrinhController {
  constructor(private readonly service: ToiChuongTrinhService) {}

  @Get('chuong-trinh')
  chuongTrinh(@CurrentUser() user: AuthenticatedUser) {
    return this.service.cuaToi(user);
  }
}
