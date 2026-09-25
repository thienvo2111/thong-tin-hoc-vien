import { Module } from '@nestjs/common';
import { ThongBaoController } from './thong-bao.controller';
import { ThongBaoService } from './thong-bao.service';

// Dịch vụ Thông báo — docs/api-contract.md mục 8. Chỉ phụ thuộc PrismaService
// (@Global(), xem prisma.module.ts) — KHÔNG phụ thuộc HocVienModule/
// KhoaBoiDuongModule, tự truy vấn prisma trực tiếp bằng id truyền vào từ nơi
// gọi. Nhờ vậy HocVienModule/KhoaBoiDuongModule import ngược lại module này
// (để lấy ThongBaoService) mà không tạo vòng lặp phụ thuộc.
@Module({
  controllers: [ThongBaoController],
  providers: [ThongBaoService],
  exports: [ThongBaoService],
})
export class ThongBaoModule {}
