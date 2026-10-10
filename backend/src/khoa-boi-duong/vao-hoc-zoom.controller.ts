import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { VaoHocZoomService } from './vao-hoc-zoom.service';

// ADR 0005 (issue #24): học viên bấm "Điểm danh & vào Zoom" của 1 buổi. Luôn
// 200 với ket_qua: chua_mo | da_ghi_nhan | da_co | qua_gio.
@Controller('lich-hoc')
export class VaoHocZoomController {
  constructor(private readonly vaoHocZoomService: VaoHocZoomService) {}

  @Roles('hoc_vien')
  @Post(':id/vao-hoc')
  @HttpCode(200)
  vaoHoc(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vaoHocZoomService.vaoHoc(id, user);
  }
}
