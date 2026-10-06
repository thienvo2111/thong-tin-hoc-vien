import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { YeuCauHoTroService } from './yeu-cau-ho-tro.service';
import { QueryYeuCauHoTroHoTroDto } from './dto/query-yeu-cau-ho-tro.dto';
import { TraLoiYeuCauHoTroDto } from './dto/tra-loi-yeu-cau-ho-tro.dto';

// ADR 0003 Lát 4: yêu cầu hỗ trợ theo cụm cho người hỗ trợ học viên.
@Roles('ho_tro_hoc_vien')
@Controller('ho-tro/yeu-cau-ho-tro')
export class HoTroYeuCauHoTroController {
  constructor(private readonly service: YeuCauHoTroService) {}

  @Get()
  danhSach(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryYeuCauHoTroHoTroDto,
  ) {
    return this.service.danhSachHoTro(user.id, query);
  }

  // Khai báo TRƯỚC :id để 'dem' không bị route động chắn.
  @Get('dem')
  dem(@CurrentUser() user: AuthenticatedUser) {
    return this.service.demHoTro(user.id);
  }

  @Get(':id')
  chiTiet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.chiTietHoTro(user.id, id);
  }

  @Patch(':id/tra-loi')
  traLoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TraLoiYeuCauHoTroDto,
  ) {
    return this.service.traLoiHoTro(user.id, id, dto);
  }
}
