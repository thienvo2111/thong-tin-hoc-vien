import { Module } from '@nestjs/common';
import { HocVienModule } from '../hoc-vien/hoc-vien.module';
import { ValidateController } from './validate.controller';

// Dịch vụ Kiểm tra dữ liệu — docs/api-contract.md mục 6. Chỉ import
// HocVienModule để tái dùng HocVienService.validateHocVien (đã export sẵn) —
// không có service/logic riêng của module này (thư viện quy tắc dùng chung,
// không phải REST service độc lập).
@Module({
  imports: [HocVienModule],
  controllers: [ValidateController],
})
export class ValidateModule {}
