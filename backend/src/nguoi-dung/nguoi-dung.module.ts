import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ThongBaoModule } from '../thong-bao/thong-bao.module';
import { NguoiDungController } from './nguoi-dung.controller';
import { NguoiDungService } from './nguoi-dung.service';
import { TaiKhoanDonViController } from './tai-khoan-don-vi.controller';
import { TaiKhoanDonViService } from './tai-khoan-don-vi.service';

@Module({
  imports: [AuthModule, ThongBaoModule],
  // TaiKhoanDonViController khai báo TRƯỚC NguoiDungController để route
  // tĩnh /nguoi-dung/don-vi không bị route động /nguoi-dung/:id/... chắn.
  controllers: [TaiKhoanDonViController, NguoiDungController],
  providers: [NguoiDungService, TaiKhoanDonViService],
  exports: [TaiKhoanDonViService],
})
export class NguoiDungModule {}
