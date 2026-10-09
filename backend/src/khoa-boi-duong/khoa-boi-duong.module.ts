import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ThongBaoModule } from '../thong-bao/thong-bao.module';
import { DiemHocModule } from '../diem-hoc/diem-hoc.module';
import { GiangVienModule } from '../giang-vien/giang-vien.module';
import { KhoaBoiDuongController } from './khoa-boi-duong.controller';
import { LopHocController } from './lop-hoc.controller';
import { DangKyHocController } from './dang-ky-hoc.controller';
import { DangKyHocKetQuaController } from './dang-ky-hoc-ket-qua.controller';
import { DangKyHocThaoTacController } from './dang-ky-hoc-thao-tac.controller';
import { HocVienKhoaHocController } from './hoc-vien-khoa-hoc.controller';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { LichHocThayDoiService } from './lich-hoc-thay-doi.service';
import { ThangMucService } from '../sso/thang-muc.service';

// Dịch vụ Khóa bồi dưỡng & Lớp học — xem docs/api-contract.md mục 3. Export
// service ra để ImportModule tái dùng (import phan_lop_hoc_vien — nguồn duy
// nhất gán dang_ky_hoc.khoa_id/lop_id, xem
// KhoaBoiDuongService.resolvePhanLopRow/commitPhanLop) — không import ngược
// lại ImportModule để tránh vòng lặp phụ thuộc module. Import ThongBaoModule
// để lấy ThongBaoService (thay 2 stub gửi email cũ bằng gửi thật, xem
// khoa-boi-duong.service.ts) — không vòng lặp vì ThongBaoModule không phụ
// thuộc ngược lại module này.
@Module({
  imports: [AuthModule, ThongBaoModule, DiemHocModule, GiangVienModule],
  controllers: [
    KhoaBoiDuongController,
    LopHocController,
    DangKyHocController,
    DangKyHocKetQuaController,
    DangKyHocThaoTacController,
    HocVienKhoaHocController,
  ],
  // ThangMucService chỉ đọc cấu hình (Prisma) — khai báo thẳng, tránh import SsoModule.
  providers: [KhoaBoiDuongService, LichHocThayDoiService, ThangMucService],
  exports: [KhoaBoiDuongService, LichHocThayDoiService],
})
export class KhoaBoiDuongModule {}
