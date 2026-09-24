import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { DanhMucModule } from '../danh-muc/danh-muc.module';

// Dịch vụ Import — docs/api-contract.md mục 5. Tái sử dụng service của
// DanhMucModule để đảm bảo cùng 1 bộ quy tắc validate cho nhập tay & import
// hàng loạt (validation-checklist.md #42).
@Module({
  imports: [DanhMucModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
