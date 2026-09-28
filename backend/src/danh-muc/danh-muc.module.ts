import { Module } from '@nestjs/common';
import { DiaDanhController } from './dia-danh/dia-danh.controller';
import { DiaDanhService } from './dia-danh/dia-danh.service';
import { DonViCongTacController } from './don-vi-cong-tac/don-vi-cong-tac.controller';
import { DonViCongTacService } from './don-vi-cong-tac/don-vi-cong-tac.service';
import { MonHocController } from './mon-hoc/mon-hoc.controller';
import { MonHocService } from './mon-hoc/mon-hoc.service';
import { ChuyenMonDaoTaoController } from './chuyen-mon-dao-tao/chuyen-mon-dao-tao.controller';
import { ChuyenMonDaoTaoService } from './chuyen-mon-dao-tao/chuyen-mon-dao-tao.service';

// Dịch vụ Danh mục dùng chung — docs/api-contract.md mục 4.
// Services export ra để ImportModule tái dùng đúng 1 bộ quy tắc validate
// cho cả nhập tay lẫn import hàng loạt (validation-checklist.md #42).
@Module({
  controllers: [
    DiaDanhController,
    DonViCongTacController,
    MonHocController,
    ChuyenMonDaoTaoController,
  ],
  providers: [
    DiaDanhService,
    DonViCongTacService,
    MonHocService,
    ChuyenMonDaoTaoService,
  ],
  exports: [DiaDanhService, DonViCongTacService, MonHocService],
})
export class DanhMucModule {}
