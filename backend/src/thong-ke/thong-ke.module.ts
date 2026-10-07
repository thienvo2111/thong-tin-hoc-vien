import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HoTroHocVienModule } from '../ho-tro-hoc-vien/ho-tro-hoc-vien.module';
import { ThongKeController } from './thong-ke.controller';
import { ThongKeScopeService } from './thong-ke-scope.service';

// Dashboard thống kê: mọi endpoint /thong-ke/* lấy phạm vi dữ liệu DUY NHẤT
// từ ThongKeScopeService (export cho BaoCaoModule dùng lại).
@Module({
  imports: [AuthModule, HoTroHocVienModule],
  controllers: [ThongKeController],
  providers: [ThongKeScopeService],
  exports: [ThongKeScopeService],
})
export class ThongKeModule {}
