import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GiangVienService } from './giang-vien.service';
import {
  CreateGiangVienDto,
  LichDayQueryDto,
  QueryGiangVienDto,
  UpdateGiangVienDto,
  XacNhanGioDto,
} from './dto/giang-vien.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// T11 (issue #3) — docs/api-contract.md mục "Giảng viên & phân công". Dữ
// liệu cá nhân giảng viên → chỉ quan_tri. Không có DELETE (ngưng = PATCH
// trang_thai). Xác nhận giờ đặt dưới /giang-vien/phan-cong/... (không mở
// thêm tiền tố Nginx /phan-cong).
@Roles('quan_tri')
@Controller('giang-vien')
export class GiangVienController {
  constructor(private readonly giangVienService: GiangVienService) {}

  @Get()
  findAll(@Query() query: QueryGiangVienDto) {
    return this.giangVienService.findAll(query);
  }

  @Post()
  create(
    @Body() dto: CreateGiangVienDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.giangVienService.create(dto, user);
  }

  @Patch('phan-cong/:id/xac-nhan-gio')
  xacNhanGio(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: XacNhanGioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.giangVienService.xacNhanGio(id, dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGiangVienDto,
  ) {
    return this.giangVienService.update(id, dto);
  }

  @Get(':id/lich-day')
  lichDay(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LichDayQueryDto,
  ) {
    return this.giangVienService.lichDay(id, query);
  }
}
