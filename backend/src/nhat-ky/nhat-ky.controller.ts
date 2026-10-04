import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { NhatKyService } from './nhat-ky.service';

@Controller('hoc-vien')
export class NhatKyController {
  constructor(private readonly nhatKyService: NhatKyService) {}

  // Chỉ quan_tri: dòng thời gian có IP/thiết bị và lịch sử của mọi bộ phận.
  @Roles('quan_tri')
  @Get(':id/nhat-ky')
  dongThoiGian(@Param('id', ParseUUIDPipe) id: string) {
    return this.nhatKyService.dongThoiGian(id);
  }
}
