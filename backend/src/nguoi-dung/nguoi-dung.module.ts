import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ThongBaoModule } from '../thong-bao/thong-bao.module';
import { NguoiDungController } from './nguoi-dung.controller';
import { NguoiDungService } from './nguoi-dung.service';
import { TaiKhoanDonViController } from './tai-khoan-don-vi.controller';
import { TaiKhoanDonViService } from './tai-khoan-don-vi.service';
import { TaiKhoanHocVienController } from './tai-khoan-hoc-vien.controller';
import { TaiKhoanHocVienService } from './tai-khoan-hoc-vien.service';

@Module({
  imports: [AuthModule, ThongBaoModule],
  // TaiKhoanDonViController/TaiKhoanHocVienController khai báo TRƯỚC
  // NguoiDungController để route tĩnh /nguoi-dung/don-vi, /nguoi-dung/hoc-vien
  // không bị route động /nguoi-dung/:id/... chắn.
  controllers: [
    TaiKhoanDonViController,
    TaiKhoanHocVienController,
    NguoiDungController,
  ],
  providers: [NguoiDungService, TaiKhoanDonViService, TaiKhoanHocVienService],
  exports: [TaiKhoanDonViService],
})
export class NguoiDungModule {}
