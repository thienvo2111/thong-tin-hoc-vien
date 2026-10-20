import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { DotNhuCauMucService } from './dot-nhu-cau-muc.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TaoDotNhuCauMucDto } from './dto/tao-dot-nhu-cau-muc.dto';
import { SuaDotNhuCauMucDto } from './dto/sua-dot-nhu-cau-muc.dto';

// ADR 0013 — quản trị CRUD đợt nhu cầu mức học. Route học viên thêm ở Task 4.
@Roles('quan_tri')
@Controller()
export class DotNhuCauMucController {
  constructor(private readonly service: DotNhuCauMucService) {}

  @Get('khoa-boi-duong/:khoaId/dot-nhu-cau-muc')
  layDanhSach(@Param('khoaId', ParseUUIDPipe) khoaId: string) {
    return this.service.layDanhSach(khoaId);
  }

  @Post('khoa-boi-duong/:khoaId/dot-nhu-cau-muc')
  taoDot(
    @Param('khoaId', ParseUUIDPipe) khoaId: string,
    @Body() dto: TaoDotNhuCauMucDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.taoDot(khoaId, dto, user.id);
  }

  @Patch('dot-nhu-cau-muc/:id')
  suaDot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuaDotNhuCauMucDto,
  ) {
    return this.service.suaDot(id, dto);
  }

  @Post('dot-nhu-cau-muc/:id/dong')
  dongDot(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.dongDot(id);
  }

  @Delete('dot-nhu-cau-muc/:id')
  @HttpCode(204)
  async xoaDot(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.xoaDot(id);
  }
}
