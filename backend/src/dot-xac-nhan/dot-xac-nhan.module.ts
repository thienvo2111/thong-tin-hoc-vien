import { Module } from '@nestjs/common';
import { DotXacNhanController } from './dot-xac-nhan.controller';
import { DotXacNhanService } from './dot-xac-nhan.service';

// Dịch vụ Đợt xác nhận — mo-rong-nls-an-giang.md mục T14. Chỉ phụ thuộc
// PrismaService (@Global()) — không phụ thuộc HocVienModule, để HocVienModule
// import ngược lại module này (lấy DotXacNhanService) mà không vòng lặp,
// cùng cách làm với ThongBaoModule (xem thong-bao.module.ts).
@Module({
  controllers: [DotXacNhanController],
  providers: [DotXacNhanService],
  exports: [DotXacNhanService],
})
export class DotXacNhanModule {}
