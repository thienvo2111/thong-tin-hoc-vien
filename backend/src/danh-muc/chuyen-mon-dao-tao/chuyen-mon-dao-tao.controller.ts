import { Controller, Get, Query } from '@nestjs/common';
import { ChuyenMonDaoTaoService } from './chuyen-mon-dao-tao.service';
import { GoiYChuyenMonQueryDto } from '../dto/chuyen-mon-dao-tao.dto';

// GET /danh-muc/chuyen-mon-dao-tao/goi-y — không @Roles() nên mọi vai trò đã
// đăng nhập gọi được (Học viên khi điền form), cùng quy ước với các endpoint
// GET danh mục khác không giới hạn vai trò trong module này.
@Controller('danh-muc/chuyen-mon-dao-tao')
export class ChuyenMonDaoTaoController {
  constructor(private readonly chuyenMonDaoTaoService: ChuyenMonDaoTaoService) {}

  @Get('goi-y')
  goiY(@Query() query: GoiYChuyenMonQueryDto) {
    return this.chuyenMonDaoTaoService.goiY(query.q);
  }
}
