import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KhoaBoiDuongModule } from '../khoa-boi-duong/khoa-boi-duong.module';
import { HocVienController } from './hoc-vien.controller';
import { HocVienService } from './hoc-vien.service';

// Dịch vụ Học viên — xem docs/api-contract.md mục 2. Import AuthModule để
// lấy ScopeService (phân quyền scope-based, xem docs/api-contract.md mục
// "Quy ước chung"). Import KhoaBoiDuongModule để gọi hook tự động tạo
// dang_ky_hoc khi hồ sơ chuyển da_duyet (rule #52, xem
// KhoaBoiDuongService.autoDangKyKhiHoSoDaDuyet). Service export ra để
// ImportModule tái dùng cho luồng import CSDL MOET (ho_so_nhan_su_moet).
@Module({
  imports: [AuthModule, KhoaBoiDuongModule],
  controllers: [HocVienController],
  providers: [HocVienService],
  exports: [HocVienService],
})
export class HocVienModule {}
