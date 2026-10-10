import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ThongBaoModule } from '../thong-bao/thong-bao.module';
import { DotXacNhanModule } from '../dot-xac-nhan/dot-xac-nhan.module';
import { CauHinhKhaoSatModule } from '../cau-hinh-khao-sat/cau-hinh-khao-sat.module';
import { KhoaBoiDuongModule } from '../khoa-boi-duong/khoa-boi-duong.module';
import { HocVienController } from './hoc-vien.controller';
import { HocVienService } from './hoc-vien.service';

// Dịch vụ Học viên — xem docs/api-contract.md mục 2. Import AuthModule để
// lấy ScopeService (phân quyền scope-based, xem docs/api-contract.md mục
// "Quy ước chung"). Import ThongBaoModule để lấy ThongBaoService (thay 2 stub
// gửi email cũ bằng gửi thật, xem hoc-vien.service.ts) — không vòng lặp vì
// ThongBaoModule không phụ thuộc ngược lại module này. Service export ra để
// ImportModule tái dùng cho luồng import CSDL MOET (ho_so_nhan_su_moet).
// Ghi danh khóa (dang_ky_hoc) không tự động theo hồ sơ da_duyet — Quản trị
// gán qua import phan_lop_hoc_vien hoặc ghi danh lẻ. Import KhoaBoiDuongModule
// chỉ cho POST /hoc-vien/tao-le (tạo lẻ kèm ghi danh, KhoaBoiDuongService.
// ghiDanhLe) — không vòng lặp vì KhoaBoiDuongModule không import module này.
@Module({
  imports: [
    AuthModule,
    ThongBaoModule,
    DotXacNhanModule,
    CauHinhKhaoSatModule,
    KhoaBoiDuongModule,
  ],
  controllers: [HocVienController],
  providers: [HocVienService],
  exports: [HocVienService],
})
export class HocVienModule {}
