import { Body, Controller, Get, Put } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CauHinhKhaoSatService } from './cau-hinh-khao-sat.service';
import { CauHinhKhaoSatDto } from './dto/cau-hinh-khao-sat.dto';

// Cấu hình khảo sát đầu vào + chế độ triển khai cho học viên (2026-10-02).
// @Roles đặt ở từng method, KHÔNG ở class — RolesGuard đọc cả metadata class
// nên @Roles cấp class sẽ chặn luôn route @Public() (không có user).
@Controller('cau-hinh-khao-sat')
export class CauHinhKhaoSatController {
  constructor(private readonly cauHinhKhaoSatService: CauHinhKhaoSatService) {}

  // Công khai: trang chủ / trang đăng nhập đọc trước khi có phiên.
  @Public()
  @Get()
  layCauHinh() {
    return this.cauHinhKhaoSatService.layCauHinh();
  }

  @Roles('quan_tri')
  @Put()
  luuCauHinh(
    @Body() dto: CauHinhKhaoSatDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cauHinhKhaoSatService.luuCauHinh(dto, user.id);
  }
}
