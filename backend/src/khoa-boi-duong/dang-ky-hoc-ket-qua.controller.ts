import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { KetQuaDangKyDto } from './dto/ket-qua-dang-ky.dto';

// PATCH /dang-ky-hoc/{id}/ket-qua — docs/api-contract.md mục 3 (thêm
// 2026-09-25). Controller riêng (không phải DangKyHocController, vốn sống ở
// prefix "hoc-vien/toi") vì URL ở đây là "/dang-ky-hoc/{id}/ket-qua", một
// resource riêng — Trường tổ chức khóa (hoặc Phòng VHXH/Sở/QuảnTrị qua
// escalation) mới có quyền nhập kết quả, KHÁC hẳn 2 endpoint GET của học
// viên tự xem trong DangKyHocController.
@Controller('dang-ky-hoc')
export class DangKyHocKetQuaController {
  constructor(private readonly khoaBoiDuongService: KhoaBoiDuongService) {}

  @Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri')
  @Patch(':id/ket-qua')
  capNhatKetQua(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: KetQuaDangKyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.capNhatKetQua(id, dto, user);
  }
}
