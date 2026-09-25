import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ThongBaoModule } from '../thong-bao/thong-bao.module';
import { HocVienController } from './hoc-vien.controller';
import { HocVienService } from './hoc-vien.service';

// Dịch vụ Học viên — xem docs/api-contract.md mục 2. Import AuthModule để
// lấy ScopeService (phân quyền scope-based, xem docs/api-contract.md mục
// "Quy ước chung"). Import ThongBaoModule để lấy ThongBaoService (thay 2 stub
// gửi email cũ bằng gửi thật, xem hoc-vien.service.ts) — không vòng lặp vì
// ThongBaoModule không phụ thuộc ngược lại module này. Service export ra để
// ImportModule tái dùng cho luồng import CSDL MOET (ho_so_nhan_su_moet).
// Không còn phụ thuộc KhoaBoiDuongModule — ghi danh khóa (dang_ky_hoc) không
// còn tự động theo hồ sơ da_duyet, chỉ do Quản trị hệ thống gán qua import
// phan_lop_hoc_vien (xem KhoaBoiDuongService.resolvePhanLopRow/commitPhanLop,
// sửa 2026-09-25).
@Module({
  imports: [AuthModule, ThongBaoModule],
  controllers: [HocVienController],
  providers: [HocVienService],
  exports: [HocVienService],
})
export class HocVienModule {}
