import { Module } from '@nestjs/common';
import { ThongBaoController } from './thong-bao.controller';
import { ThongBaoService } from './thong-bao.service';
import { HangDoiEmailProcessor } from './hang-doi-email.processor';

// Dịch vụ Thông báo — docs/api-contract.md mục 8. Chỉ phụ thuộc PrismaService
// (@Global(), xem prisma.module.ts) — KHÔNG phụ thuộc HocVienModule/
// KhoaBoiDuongModule, tự truy vấn prisma trực tiếp bằng id truyền vào từ nơi
// gọi. Nhờ vậy HocVienModule/KhoaBoiDuongModule import ngược lại module này
// (để lấy ThongBaoService) mà không tạo vòng lặp phụ thuộc.
//
// M9 (2026-10-01): HangDoiEmailProcessor (cron drain hang_doi_email) khai
// báo ở đây — cần ScheduleModule.forRoot() đăng ký ở AppModule (@Global())
// để decorator @Cron() hoạt động, xem app.module.ts.
@Module({
  controllers: [ThongBaoController],
  providers: [ThongBaoService, HangDoiEmailProcessor],
  exports: [ThongBaoService],
})
export class ThongBaoModule {}
