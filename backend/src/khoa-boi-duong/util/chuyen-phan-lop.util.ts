import { PrismaClient } from '@prisma/client';

// Chỉ đọc — chạy TRƯỚC migration 20261002090100 (xem
// scripts/kiem-tra-chuyen-phan-lop.ts). Cùng phép JOIN với migration đó.
// GIỮ file này tới khi migration DROP dang_ky_hoc_lop đã chạy trên VPS (dùng
// SQL thô vì model Prisma của bảng nguồn đã gỡ khỏi schema).

export function timXungDotChuyenPhanLop(prisma: PrismaClient) {
  return prisma.$queryRaw<
    { dang_ky_hoc_id: string; giai_doan_id: string; so_lop: number }[]
  >`
    SELECT dkl."dang_ky_hoc_id", lh."giai_doan_id",
           COUNT(DISTINCT dkl."lop_id")::int AS so_lop
    FROM "dang_ky_hoc_lop" dkl
    JOIN "lich_hoc_lop" lh ON lh."lop_id" = dkl."lop_id"
    GROUP BY dkl."dang_ky_hoc_id", lh."giai_doan_id"
    HAVING COUNT(DISTINCT dkl."lop_id") > 1`;
}

export function timPhanLopChuaCoGiaiDoan(prisma: PrismaClient) {
  return prisma.$queryRaw<
    { dang_ky_hoc_id: string; lop_id: string; ten_lop: string }[]
  >`
    SELECT dkl."dang_ky_hoc_id", dkl."lop_id", l."ten_lop"
    FROM "dang_ky_hoc_lop" dkl
    JOIN "lop_hoc" l ON l."id" = dkl."lop_id"
    WHERE NOT EXISTS (
      SELECT 1 FROM "lich_hoc_lop" lh WHERE lh."lop_id" = dkl."lop_id")`;
}
