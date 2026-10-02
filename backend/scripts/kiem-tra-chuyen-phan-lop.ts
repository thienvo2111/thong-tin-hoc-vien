// Chạy TRƯỚC khi deploy migration 20261002090100 (chỉ đọc):
//   npx ts-node scripts/kiem-tra-chuyen-phan-lop.ts
import { PrismaClient } from '@prisma/client';
import {
  timPhanLopChuaCoGiaiDoan,
  timXungDotChuyenPhanLop,
} from '../src/khoa-boi-duong/util/chuyen-phan-lop.util';

(async () => {
  const prisma = new PrismaClient();
  const xungDot = await timXungDotChuyenPhanLop(prisma);
  const chuaCoGiaiDoan = await timPhanLopChuaCoGiaiDoan(prisma);
  console.log(`Xung đột (migration sẽ FAIL nếu > 0): ${xungDot.length}`);
  console.table(xungDot);
  console.log(
    `Gán lớp chưa có buổi (sẽ KHÔNG được chuyển): ${chuaCoGiaiDoan.length}`,
  );
  console.table(chuaCoGiaiDoan);
  await prisma.$disconnect();
  process.exit(xungDot.length > 0 ? 1 : 0);
})();
