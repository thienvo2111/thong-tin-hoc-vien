import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DotTrienKhaiService } from './dot-trien-khai.service';
import {
  SuaDotTrienKhaiDto,
  TaoDotTrienKhaiDto,
} from './dto/dot-trien-khai.dto';

// Issue #56 / ADR 0015 M1, T1, T3: Quản trị quản lý đợt triển khai (Cổng đơn vị).
@Roles('quan_tri')
@Controller('cong-don-vi')
export class DotTrienKhaiController {
  constructor(private readonly service: DotTrienKhaiService) {}

  @Get('dot-trien-khai')
  layDanhSach() {
    return this.service.layDanhSach();
  }

  @Get('dot-trien-khai/:id')
  layMot(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.layMot(id);
  }

  @Post('dot-trien-khai')
  tao(@Body() dto: TaoDotTrienKhaiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.tao(dto, user.id);
  }

  @Patch('dot-trien-khai/:id')
  sua(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SuaDotTrienKhaiDto) {
    return this.service.sua(id, dto);
  }
}
