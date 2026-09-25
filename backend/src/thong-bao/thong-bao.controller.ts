import { Controller, Get, Query } from '@nestjs/common';
import { ThongBaoService } from './thong-bao.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { LichSuThongBaoQueryDto } from './dto/lich-su-thong-bao-query.dto';

// Dịch vụ Thông báo — docs/api-contract.md mục 8. Nội bộ, chỉ có 1 endpoint
// public duy nhất để tra soát lịch sử gửi.
@Controller('thong-bao')
export class ThongBaoController {
  constructor(private readonly thongBaoService: ThongBaoService) {}

  @Roles('quan_tri')
  @Get('lich-su')
  lichSu(@Query() query: LichSuThongBaoQueryDto) {
    return this.thongBaoService.lichSu(query);
  }
}
