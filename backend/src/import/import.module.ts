import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { DanhMucModule } from '../danh-muc/danh-muc.module';
import { HocVienModule } from '../hoc-vien/hoc-vien.module';

// Dịch vụ Import — docs/api-contract.md mục 5. Tái sử dụng service của
// DanhMucModule/HocVienModule để đảm bảo cùng 1 bộ quy tắc validate cho nhập
// tay & import hàng loạt (validation-checklist.md #42).
@Module({
  imports: [DanhMucModule, HocVienModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
