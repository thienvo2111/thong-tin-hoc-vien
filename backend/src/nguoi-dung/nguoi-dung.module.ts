import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ThongBaoModule } from '../thong-bao/thong-bao.module';
import { NguoiDungController } from './nguoi-dung.controller';
import { NguoiDungService } from './nguoi-dung.service';
import { TaiKhoanDonViController } from './tai-khoan-don-vi.controller';
import { TaiKhoanDonViService } from './tai-khoan-don-vi.service';
import { TaiKhoanHoTroController } from './tai-khoan-ho-tro.controller';
import { TaiKhoanHoTroService } from './tai-khoan-ho-tro.service';
import { TaiKhoanHocVienController } from './tai-khoan-hoc-vien.controller';
import { TaiKhoanHocVienService } from './tai-khoan-hoc-vien.service';

@Module({
  imports: [AuthModule, ThongBaoModule],
  // TaiKhoanDonVi/TaiKhoanHoTro/TaiKhoanHocVienController khai báo TRƯỚC
  // NguoiDungController để route tĩnh /nguoi-dung/don-vi, /ho-tro, /hoc-vien
  // không bị route động /nguoi-dung/:id/... chắn.
  controllers: [
    TaiKhoanDonViController,
    TaiKhoanHoTroController,
    TaiKhoanHocVienController,
    NguoiDungController,
  ],
  providers: [
    NguoiDungService,
    TaiKhoanDonViService,
    TaiKhoanHoTroService,
    TaiKhoanHocVienService,
  ],
  exports: [TaiKhoanDonViService],
})
export class NguoiDungModule {}
