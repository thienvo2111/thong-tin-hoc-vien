import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { NguoiDungService } from './nguoi-dung.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TimKiemNguoiDungQueryDto } from './dto/tim-kiem-nguoi-dung-query.dto';

// Dịch vụ Quản lý tài khoản — T1 mo-rong-nls-an-giang.md. Cả 2 endpoint chỉ
// quan_tri (thao tác vận hành N4: hỗ trợ học viên quên mật khẩu/bị khóa).
@Controller('nguoi-dung')
export class NguoiDungController {
  constructor(private readonly nguoiDungService: NguoiDungService) {}

  @Roles('quan_tri')
  @Post(':id/dat-lai-mat-khau')
  @HttpCode(HttpStatus.OK)
  datLaiMatKhau(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nguoiDungService.datLaiMatKhau(id, user);
  }

  @Roles('quan_tri')
  @Get()
  timKiem(@Query() query: TimKiemNguoiDungQueryDto) {
    return this.nguoiDungService.timKiem(query.q);
  }
}
