import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HoTroHocVienModule } from '../ho-tro-hoc-vien/ho-tro-hoc-vien.module';
import { SsoModule } from '../sso/sso.module';
import { DoiBuoiHocQueryModule } from '../doi-buoi-hoc/doi-buoi-hoc-query.module';
import { TinhHinhDiHocModule } from '../tinh-hinh-di-hoc/tinh-hinh-di-hoc.module';
import { BieuMauService } from './bieu-mau.service';
import { ChatLuongHoSoService } from './chat-luong-ho-so.service';
import { CanDonDocService } from './can-don-doc.service';
import { DanhSachHocVienService } from './danh-sach-hoc-vien.service';
import { MucNlsService } from './muc-nls.service';
import { NhuCauMucHocService } from './nhu-cau-muc-hoc.service';
import { NhuCauMucDotService } from './nhu-cau-muc-dot.service';
import { ThongKeController } from './thong-ke.controller';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThongKeService } from './thong-ke.service';
import { TienDoTruongService } from './tien-do-truong.service';
import { XepHangService } from './xep-hang.service';

// Dashboard thống kê: mọi endpoint /thong-ke/* lấy phạm vi dữ liệu DUY NHẤT
// từ ThongKeScopeService (export cho BaoCaoModule dùng lại).
@Module({
  imports: [
    AuthModule,
    HoTroHocVienModule,
    SsoModule,
    DoiBuoiHocQueryModule,
    TinhHinhDiHocModule,
  ],
  controllers: [ThongKeController],
  providers: [
    ThongKeScopeService,
    ThongKeService,
    XepHangService,
    CanDonDocService,
    TienDoTruongService,
    BieuMauService,
    ChatLuongHoSoService,
    MucNlsService,
    NhuCauMucHocService,
    NhuCauMucDotService,
    DanhSachHocVienService,
  ],
  exports: [ThongKeScopeService],
})
export class ThongKeModule {}
