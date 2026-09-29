import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { DanhMucModule } from '../danh-muc/danh-muc.module';
import { HocVienModule } from '../hoc-vien/hoc-vien.module';
import { KhoaBoiDuongModule } from '../khoa-boi-duong/khoa-boi-duong.module';
import { DotXacNhanModule } from '../dot-xac-nhan/dot-xac-nhan.module';

// Dịch vụ Import — docs/api-contract.md mục 5. Tái sử dụng service của
// DanhMucModule/HocVienModule/KhoaBoiDuongModule để đảm bảo cùng 1 bộ quy tắc
// validate cho nhập tay & import hàng loạt (validation-checklist.md #42).
// DotXacNhanModule thêm ở T5 (mo-rong-nls-an-giang.md, 2026-09-29) — chỉ
// dùng để tính cảnh báo "lách cổng" cho import ket_qua_danh_gia (không phụ
// thuộc ngược, xem dot-xac-nhan.module.ts).
@Module({
  imports: [DanhMucModule, HocVienModule, KhoaBoiDuongModule, DotXacNhanModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
