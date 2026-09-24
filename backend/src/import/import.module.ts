import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { DanhMucModule } from '../danh-muc/danh-muc.module';
import { HocVienModule } from '../hoc-vien/hoc-vien.module';
import { KhoaBoiDuongModule } from '../khoa-boi-duong/khoa-boi-duong.module';

// Dịch vụ Import — docs/api-contract.md mục 5. Tái sử dụng service của
// DanhMucModule/HocVienModule/KhoaBoiDuongModule để đảm bảo cùng 1 bộ quy tắc
// validate cho nhập tay & import hàng loạt (validation-checklist.md #42).
@Module({
  imports: [DanhMucModule, HocVienModule, KhoaBoiDuongModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
