import { Controller, Get } from '@nestjs/common';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// docs/api-contract.md mục 3 — GET /hoc-vien/toi/khoa-hoc và /ket-qua. Sống
// trong khoa-boi-duong module (không phải hoc-vien module) để tránh nhân đôi
// logic truy vấn dang_ky_hoc ở 2 nơi, dù URL nằm dưới prefix "hoc-vien/toi"
// (chấp nhận được — Nest không yêu cầu 1 prefix chỉ do 1 controller sở hữu).
@Controller('hoc-vien/toi')
export class DangKyHocController {
  constructor(private readonly khoaBoiDuongService: KhoaBoiDuongService) {}

  @Roles('hoc_vien')
  @Get('khoa-hoc')
  khoaHocCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.khoaBoiDuongService.khoaHocCuaToi(user);
  }

  @Roles('hoc_vien')
  @Get('ket-qua')
  ketQuaCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.khoaBoiDuongService.ketQuaCuaToi(user);
  }
}
