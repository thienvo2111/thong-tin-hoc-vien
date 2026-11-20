import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TruongDanhSachService } from './truong-danh-sach.service';
import { GuiDeNghiDto, YKienDongDto } from './dto/truong-danh-sach.dto';

// Issue #60 / ADR 0015 U1, X6, O3: trang chủ trường (thẻ đợt) + xem danh sách tham gia của chính trường.
// Issue #61 / X1, X2: Đồng ý / Không đồng ý từng dòng, Đồng ý tất cả, Xác nhận danh sách.
// Issue #62 / X2: gửi đề nghị sửa/thêm/bớt người (trường không gọi được API sửa dòng của Quản trị).
// Sở/Phòng xem ở lát sau (#71) — hiện chỉ vai trò truong.
@Roles('truong')
@Controller('cong-don-vi/truong')
export class TruongDanhSachController {
  constructor(private readonly service: TruongDanhSachService) {}

  @Get('dot')
  dotCuaTruong(@CurrentUser() user: AuthenticatedUser) {
    return this.service.dotCuaTruong(user);
  }

  @Get('dot/:dotId/danh-sach')
  danhSach(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.danhSachCuaTruong(user, dotId);
  }

  @Put('dot/:dotId/danh-sach/:dongId/y-kien')
  datYKien(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @Param('dongId', ParseUUIDPipe) dongId: string,
    @Body() dto: YKienDongDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.datYKien(user, dotId, dongId, dto.y_kien);
  }

  @Post('dot/:dotId/danh-sach/dong-y-tat-ca')
  @HttpCode(200)
  dongYTatCa(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.dongYTatCa(user, dotId);
  }

  @Post('dot/:dotId/danh-sach/xac-nhan')
  @HttpCode(200)
  xacNhan(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.xacNhan(user, dotId);
  }

  // Issue #62: trả lại cả danh sách (kèm đề nghị) như các thao tác khác của trường.
  @Post('dot/:dotId/de-nghi')
  guiDeNghi(
    @Param('dotId', ParseUUIDPipe) dotId: string,
    @Body() dto: GuiDeNghiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.guiDeNghi(user, dotId, dto);
  }
}
