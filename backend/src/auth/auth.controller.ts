import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { DangNhapDto } from './dto/dang-nhap.dto';
import { DoiMatKhauDto } from './dto/doi-mat-khau.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('dang-nhap')
  @HttpCode(HttpStatus.OK)
  dangNhap(@Body() dto: DangNhapDto) {
    return this.authService.dangNhap(dto);
  }

  @Post('doi-mat-khau')
  @HttpCode(HttpStatus.OK)
  doiMatKhau(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DoiMatKhauDto,
  ) {
    return this.authService.doiMatKhau(user, dto);
  }

  @Get('toi')
  layThongTinHienTai(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.layThongTinHienTai(user);
  }
}
