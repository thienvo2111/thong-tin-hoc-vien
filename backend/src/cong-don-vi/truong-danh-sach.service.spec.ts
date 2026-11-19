import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TruongDanhSachService } from './truong-danh-sach.service';

// Issue #60, #61: tài khoản trường chưa gắn đơn vị → 403 rõ lý do, không truy vấn DB, không ghi nhật ký.
// (CHECK chk_nguoi_dung_scope chặn tạo tài khoản như vậy trong DB nên không e2e được.)
describe('TruongDanhSachService — tài khoản trường không có don_vi_id', () => {
  const prisma = {
    hop_dong_boi_duong: { findMany: jest.fn(), findUnique: jest.fn() },
    danh_sach_tham_gia: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const nhatKy = { ghi: jest.fn() };
  const service = new TruongDanhSachService(
    prisma as unknown as PrismaService,
    nhatKy as unknown as NhatKyService,
  );
  const user = {
    id: 'u-1',
    vai_tro: 'truong',
    don_vi_id: null,
  } as unknown as AuthenticatedUser;

  const DOT = '00000000-0000-0000-0000-000000000000';
  it.each([
    ['dotCuaTruong', () => service.dotCuaTruong(user)],
    ['danhSachCuaTruong', () => service.danhSachCuaTruong(user, DOT)],
    ['datYKien', () => service.datYKien(user, DOT, DOT, 'dong_y')],
    ['dongYTatCa', () => service.dongYTatCa(user, DOT)],
    ['xacNhan', () => service.xacNhan(user, DOT)],
  ])('%s → 403 "chưa gắn đơn vị", không gọi DB', async (_ten, goi) => {
    const loi = await goi().catch((e: unknown) => e);
    expect(loi).toBeInstanceOf(ForbiddenException);
    expect(JSON.stringify((loi as ForbiddenException).getResponse())).toMatch(
      /chưa gắn đơn vị/,
    );
    expect(prisma.hop_dong_boi_duong.findMany).not.toHaveBeenCalled();
    expect(prisma.hop_dong_boi_duong.findUnique).not.toHaveBeenCalled();
    expect(prisma.danh_sach_tham_gia.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });
});
