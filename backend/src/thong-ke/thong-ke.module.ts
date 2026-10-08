import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HoTroHocVienModule } from '../ho-tro-hoc-vien/ho-tro-hoc-vien.module';
import { SsoModule } from '../sso/sso.module';
import { BieuMauService } from './bieu-mau.service';
import { CanDonDocService } from './can-don-doc.service';
import { ThongKeController } from './thong-ke.controller';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThongKeService } from './thong-ke.service';
import { TienDoTruongService } from './tien-do-truong.service';
import { XepHangService } from './xep-hang.service';

// Dashboard thống kê: mọi endpoint /thong-ke/* lấy phạm vi dữ liệu DUY NHẤT
// từ ThongKeScopeService (export cho BaoCaoModule dùng lại).
@Module({
  imports: [AuthModule, HoTroHocVienModule, SsoModule],
  controllers: [ThongKeController],
  providers: [
    ThongKeScopeService,
    ThongKeService,
    XepHangService,
    CanDonDocService,
    TienDoTruongService,
    BieuMauService,
  ],
  exports: [ThongKeScopeService],
})
export class ThongKeModule {}
