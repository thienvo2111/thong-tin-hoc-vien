import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongKeScopeService } from './thong-ke-scope.service';

// hoc_vien không có phạm vi thống kê -> RolesGuard tự trả 403.
@Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri', 'ho_tro_hoc_vien')
@Controller('thong-ke')
export class ThongKeController {
  constructor(private readonly scopeService: ThongKeScopeService) {}

  @Get('bo-loc')
  boLoc(@CurrentUser() user: AuthenticatedUser) {
    return this.scopeService.boLoc(user);
  }
}
