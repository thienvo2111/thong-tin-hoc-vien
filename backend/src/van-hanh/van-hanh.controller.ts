import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { VanHanhService } from './van-hanh.service';

// ADR 0004 G15 (issue #22): màn giám sát vận hành — chỉ Quản trị, chỉ đọc.
@Roles('quan_tri')
@Controller('van-hanh')
export class VanHanhController {
  constructor(private readonly service: VanHanhService) {}

  @Get()
  tongHop() {
    return this.service.tongHop();
  }
}
