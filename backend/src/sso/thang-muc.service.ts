import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationException } from '../common/exceptions/app.exceptions';
import { MucThangDto } from './dto/thang-muc.dto';

// Thang mức kết quả của hệ thống khảo sát (2026-10-05) — quản trị tự sửa ở trang Cấu hình khảo sát.
// Hệ thống khảo sát chỉ gửi MÃ (`muc_goc`), cổng tra nhãn ở đây. Chưa quy đổi sang `muc` xếp lớp.
export const KHOA_THANG_MUC = 'thang_muc_khao_sat';

export interface MucThang {
  ma: string;
  nhan: string;
}

export const THANG_MUC_MAC_DINH: MucThang[] = [
  { ma: 'M1', nhan: 'Chưa đạt' },
  { ma: 'M2', nhan: 'Cơ bản' },
  { ma: 'M3', nhan: 'Thành thạo' },
  { ma: 'M4', nhan: 'Nâng cao' },
];

/** "M1" -> "M1 – Chưa đạt"; mã không còn trong thang (đã bị xóa khỏi cấu hình) -> giữ nguyên mã. */
export function nhanMucGoc(
  ma: string | null,
  thang: MucThang[],
): string | null {
  if (!ma) return null;
  const muc = thang.find((m) => m.ma === ma);
  return muc ? `${muc.ma} – ${muc.nhan}` : ma;
}

@Injectable()
export class ThangMucService {
  constructor(private readonly prisma: PrismaService) {}

  async lay(): Promise<{ thang: MucThang[]; cap_nhat_luc: Date | null }> {
    const row = await this.prisma.cau_hinh_he_thong.findUnique({
      where: { khoa: KHOA_THANG_MUC },
    });
    return {
      thang: (row?.gia_tri as unknown as MucThang[]) ?? THANG_MUC_MAC_DINH,
      cap_nhat_luc: row?.cap_nhat_luc ?? null,
    };
  }

  async thang(): Promise<MucThang[]> {
    return (await this.lay()).thang;
  }

  /** Mã gửi về phải có trong thang đang cấu hình. */
  async kiemTraMa(ma: string, thang?: MucThang[]): Promise<void> {
    const ds = thang ?? (await this.thang());
    if (!ds.some((m) => m.ma === ma)) {
      throw new ValidationException('Mã mức không có trong thang mức', [
        {
          field: 'muc_goc',
          message: `Chỉ nhận: ${ds.map((m) => m.ma).join(', ')}`,
        },
      ]);
    }
  }

  async luu(muc: MucThangDto[], nguoiCapNhatId: string) {
    const thang = muc.map((m) => ({
      ma: m.ma.trim().toUpperCase(),
      nhan: m.nhan.trim().normalize('NFC'),
    }));
    const trung = thang.find(
      (m, i) => thang.findIndex((x) => x.ma === m.ma) !== i,
    );
    if (trung) {
      throw new ValidationException('Mã mức bị trùng', [
        { field: 'muc', message: `Mã "${trung.ma}" xuất hiện nhiều lần` },
      ]);
    }
    const now = new Date();
    await this.prisma.cau_hinh_he_thong.upsert({
      where: { khoa: KHOA_THANG_MUC },
      create: {
        khoa: KHOA_THANG_MUC,
        gia_tri: thang as unknown as object,
        cap_nhat_luc: now,
        cap_nhat_boi: nguoiCapNhatId,
      },
      update: {
        gia_tri: thang as unknown as object,
        cap_nhat_luc: now,
        cap_nhat_boi: nguoiCapNhatId,
      },
    });
    return { thang, cap_nhat_luc: now };
  }
}
