import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import { Public } from '../auth/decorators/public.decorator';
import { CreateHocVienDto } from '../hoc-vien/dto/create-hoc-vien.dto';

// Dịch vụ Kiểm tra dữ liệu — docs/api-contract.md mục 6. Không phải REST
// service độc lập với bộ quy tắc riêng: gọi thẳng HocVienService.validateHocVien
// (CÙNG hàm dùng bởi POST /hoc-vien và POST /hoc-vien/toi/kiem-tra-truoc-xac-nhan)
// ở chế độ requireFull=true (khớp shape body của POST /hoc-vien). Dry-run
// thuần túy: không bao giờ ghi DB, chỉ trả { loi, canh_bao }. Công khai — cùng
// lý do như POST /hoc-vien và GET /hoc-vien/kiem-tra-trung (phải gọi được
// trước khi có tài khoản).
@Controller('validate')
export class ValidateController {
  constructor(private readonly hocVienService: HocVienService) {}

  @Public()
  @Post('hoc-vien')
  @HttpCode(HttpStatus.OK)
  validateHocVien(@Body() dto: CreateHocVienDto) {
    return this.hocVienService.validateHocVien(dto, { requireFull: true });
  }
}
