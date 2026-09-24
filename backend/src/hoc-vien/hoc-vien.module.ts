import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HocVienController } from './hoc-vien.controller';
import { HocVienService } from './hoc-vien.service';

// Dịch vụ Học viên — xem docs/api-contract.md mục 2. Import AuthModule để
// lấy ScopeService (phân quyền scope-based, xem docs/api-contract.md mục
// "Quy ước chung"). Service export ra để ImportModule tái dùng cho luồng
// import CSDL MOET (ho_so_nhan_su_moet).
@Module({
  imports: [AuthModule],
  controllers: [HocVienController],
  providers: [HocVienService],
  exports: [HocVienService],
})
export class HocVienModule {}
