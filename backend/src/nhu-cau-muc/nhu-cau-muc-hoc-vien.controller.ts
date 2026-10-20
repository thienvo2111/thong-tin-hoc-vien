import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NhuCauMucHocVienService } from './nhu-cau-muc-hoc-vien.service';
import { ChonNhuCauMucDto } from './dto/chon-nhu-cau-muc.dto';

// ADR 0013 — học viên xem/chọn nhu cầu mức học theo đợt.
@Roles('hoc_vien')
@Controller('hoc-vien/toi/nhu-cau-muc')
export class NhuCauMucHocVienController {
  constructor(private readonly service: NhuCauMucHocVienService) {}

  @Get()
  danhSach(@CurrentUser() caller: AuthenticatedUser) {
    return this.service.danhSach(caller);
  }

  @Get(':dotId')
  chiTiet(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.chiTiet(caller, dotId);
  }

  @Put(':dotId')
  chon(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @Body() dto: ChonNhuCauMucDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.chon(caller, dotId, dto.muc);
  }
}
