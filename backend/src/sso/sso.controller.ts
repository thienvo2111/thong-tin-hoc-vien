import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { SsoService } from './sso.service';
import { CapMaSsoDto, DoiMaSsoDto, MaThuSsoDto } from './dto/sso.dto';

// SSO sang hệ thống khảo sát (2026-10-02). @Roles đặt ở từng method — @Roles
// cấp class sẽ chặn luôn route @Public() (xem cau-hinh-khao-sat.controller.ts).
@Controller('sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Roles('hoc_vien')
  @Post('cap-ma')
  capMa(@Body() dto: CapMaSsoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ssoService.capMa(user, dto.target);
  }

  // Mã THỬ để tích hợp (quản trị) — xem SsoService.taoMaThu.
  @Roles('quan_tri')
  @Post('ma-thu')
  maThu(@Body() dto: MaThuSsoDto) {
    return this.ssoService.taoMaThu(dto.ma_dinh_danh_moet.trim(), dto.target);
  }

  // Gọi từ MÁY CHỦ hệ thống khảo sát (server-to-server), không phải trình
  // duyệt: không có JWT, xác thực bằng header X-API-Key.
  @Public()
  @Post('doi-ma')
  @HttpCode(200)
  doiMa(@Body() dto: DoiMaSsoDto, @Headers('x-api-key') apiKey?: string) {
    return this.ssoService.doiMa(apiKey, dto.code);
  }
}
