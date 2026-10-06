import { Injectable } from '@nestjs/common';
import { Prisma, vai_tro_nhan_su_lop } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { formatVnDateTime } from '../common/utils/vn-datetime.util';

export interface MucPhanCong {
  giang_vien_id: string;
  vai_tro: vai_tro_nhan_su_lop;
  so_gio?: number;
}

interface KhoangGio {
  thoi_gian_bat_dau: Date;
  thoi_gian_ket_thuc: Date;
}

/** Hàm thuần: 2 khoảng giờ chồng nhau (chạm biên — buổi này kết thúc đúng lúc buổi kia bắt đầu — không tính). */
export function chongGio(a: KhoangGio, b: KhoangGio): boolean {
  return (
    a.thoi_gian_bat_dau < b.thoi_gian_ket_thuc &&
    b.thoi_gian_bat_dau < a.thoi_gian_ket_thuc
  );
}

const BUOI_MO_TA = {
  id: true,
  buoi_so: true,
  thoi_gian_bat_dau: true,
  thoi_gian_ket_thuc: true,
  lop: { select: { ten_lop: true, khoa: { select: { ma_khoa: true } } } },
} satisfies Prisma.lich_hoc_lopSelect;

type BuoiMoTa = Prisma.lich_hoc_lopGetPayload<{ select: typeof BUOI_MO_TA }>;

export function moTaBuoi(b: BuoiMoTa): string {
  return `buổi ${b.buoi_so} lớp "${b.lop.ten_lop}" (khóa ${b.lop.khoa.ma_khoa}, ${formatVnDateTime(b.thoi_gian_bat_dau)})`;
}

// T11 (issue #3) + ADR 0004 G12: luật phân công giảng viên vào buổi — DUY
// NHẤT ở đây, dùng chung cho import phan_cong_giang_day, Quản trị sửa tay và
// (sau này) người hỗ trợ giảng viên:
//  - 1 giảng viên không được dạy 2 buổi chồng giờ (rule 🔴).
//  - Phân công đã xác nhận giờ không gỡ/đổi số giờ được (409) — giờ đã chốt
//    để thanh toán; muốn đổi thì Quản trị bỏ xác nhận trước.
@Injectable()
export class PhanCongGiangDayService {
  constructor(private readonly prisma: PrismaService) {}

  /** Buổi khác (đã phân công cho giảng viên này) chồng giờ với khoảng đang xét; null nếu không có. */
  async timBuoiTrungGio(
    giangVienId: string,
    khoang: KhoangGio,
    boQuaLichHocId?: string,
  ): Promise<BuoiMoTa | null> {
    const pc = await this.prisma.phan_cong_giang_day.findFirst({
      where: {
        giang_vien_id: giangVienId,
        lich_hoc: {
          ...(boQuaLichHocId ? { id: { not: boQuaLichHocId } } : {}),
          thoi_gian_bat_dau: { lt: khoang.thoi_gian_ket_thuc },
          thoi_gian_ket_thuc: { gt: khoang.thoi_gian_bat_dau },
        },
      },
      select: { lich_hoc: { select: BUOI_MO_TA } },
    });
    return pc?.lich_hoc ?? null;
  }

  /**
   * Đổi giờ 1 buổi đã có phân công: giảng viên nào của buổi bị trùng giờ với
   * buổi khác của họ → thông báo lỗi; null nếu đổi được.
   */
  async xungDotKhiDoiGio(
    lichHocId: string,
    khoang: KhoangGio,
  ): Promise<string | null> {
    const dsPhanCong = await this.prisma.phan_cong_giang_day.findMany({
      where: { lich_hoc_id: lichHocId },
      select: { giang_vien: { select: { id: true, ho_ten: true } } },
    });
    for (const { giang_vien } of dsPhanCong) {
      const trung = await this.timBuoiTrungGio(
        giang_vien.id,
        khoang,
        lichHocId,
      );
      if (trung) {
        return `Giảng viên "${giang_vien.ho_ten}" đã dạy ${moTaBuoi(trung)} trùng giờ mới`;
      }
    }
    return null;
  }

  /** Thay TOÀN BỘ phân công của 1 buổi (rỗng = gỡ hết phân công chưa xác nhận giờ). */
  async thayPhanCongBuoi(lichHocId: string, ds: MucPhanCong[]) {
    const lich = await this.prisma.lich_hoc_lop.findUnique({
      where: { id: lichHocId },
    });
    if (!lich) throw new NotFoundAppException('Không tìm thấy buổi học');

    const ids = ds.map((m) => m.giang_vien_id);
    if (new Set(ids).size !== ids.length) {
      throw new ValidationException('Một giảng viên xuất hiện 2 lần', [
        { field: 'phan_cong', message: 'Trùng giảng viên' },
      ]);
    }
    const dsGiangVien = await this.prisma.giang_vien.findMany({
      where: { id: { in: ids } },
    });
    for (const m of ds) {
      const gv = dsGiangVien.find((g) => g.id === m.giang_vien_id);
      if (!gv || gv.trang_thai !== 'active') {
        throw new ValidationException(
          'Giảng viên không tồn tại hoặc đã ngừng',
          [{ field: 'phan_cong', message: 'Giảng viên không hợp lệ' }],
        );
      }
      const trung = await this.timBuoiTrungGio(gv.id, lich, lich.id);
      if (trung) {
        throw new ValidationException(
          `Giảng viên "${gv.ho_ten}" đã dạy ${moTaBuoi(trung)} trùng giờ buổi này`,
          [{ field: 'phan_cong', message: 'Trùng giờ' }],
        );
      }
    }

    const hienCo = await this.prisma.phan_cong_giang_day.findMany({
      where: { lich_hoc_id: lichHocId },
      include: { giang_vien: { select: { ho_ten: true } } },
    });
    for (const pc of hienCo.filter((p) => p.da_xac_nhan_gio)) {
      const moi = ds.find((m) => m.giang_vien_id === pc.giang_vien_id);
      if (!moi) {
        throw new ConflictAppException(
          `Không gỡ được "${pc.giang_vien.ho_ten}" — giờ dạy đã được xác nhận`,
        );
      }
      if (moi.so_gio !== undefined && Number(pc.so_gio) !== moi.so_gio) {
        throw new ConflictAppException(
          `Không đổi số giờ của "${pc.giang_vien.ho_ten}" — giờ dạy đã được xác nhận`,
        );
      }
    }

    const goBo = hienCo
      .filter((p) => !ids.includes(p.giang_vien_id))
      .map((p) => p.id);
    await this.prisma.$transaction([
      this.prisma.phan_cong_giang_day.deleteMany({
        where: { id: { in: goBo } },
      }),
      ...ds.map((m) =>
        this.prisma.phan_cong_giang_day.upsert({
          where: {
            lich_hoc_id_giang_vien_id: {
              lich_hoc_id: lichHocId,
              giang_vien_id: m.giang_vien_id,
            },
          },
          create: {
            lich_hoc_id: lichHocId,
            giang_vien_id: m.giang_vien_id,
            vai_tro: m.vai_tro,
            so_gio: m.so_gio,
          },
          update: { vai_tro: m.vai_tro, so_gio: m.so_gio },
        }),
      ),
    ]);
    return this.dsPhanCongBuoi(lichHocId);
  }

  dsPhanCongBuoi(lichHocId: string) {
    return this.prisma.phan_cong_giang_day.findMany({
      where: { lich_hoc_id: lichHocId },
      include: { giang_vien: { select: { id: true, ho_ten: true } } },
      orderBy: { created_at: 'asc' },
    });
  }
}
