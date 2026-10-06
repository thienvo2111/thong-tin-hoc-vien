import { Injectable } from '@nestjs/common';
import { lich_hoc_lop, trang_thai_lich_hoc } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';

// Các trường mà học viên/giảng viên cần được báo lại khi đổi (giờ, địa điểm)
// — đổi 1 trong số này mới cập nhật cap_nhat_luc + ghi nhật ký sua_lich_hoc
// (ADR 0004 P0/G11: "cần nhắc lại" so cap_nhat_luc với lần nhắc cuối).
export const TRUONG_LICH_THEO_DOI = [
  'thoi_gian_bat_dau',
  'thoi_gian_ket_thuc',
  'dia_diem_hoac_link',
  'diem_hoc_id',
  'phong',
] as const;
type TruongTheoDoi = (typeof TRUONG_LICH_THEO_DOI)[number];

export interface ThayDoiLichHoc {
  thoi_gian_bat_dau?: Date;
  thoi_gian_ket_thuc?: Date;
  dia_diem_hoac_link?: string | null;
  diem_hoc_id?: string | null;
  phong?: string | null;
  buoi_so?: number;
  trang_thai?: trang_thai_lich_hoc;
}

type GiaTri = string | null;

function chuanHoa(v: Date | string | null | undefined): GiaTri {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : v;
}

// Hàm thuần: trường theo dõi nào thực sự đổi giá trị. undefined = không đổi.
export function soSanhLichHoc(
  cu: Pick<lich_hoc_lop, TruongTheoDoi>,
  moi: ThayDoiLichHoc,
): { truoc: Record<string, GiaTri>; sau: Record<string, GiaTri> } | null {
  const truoc: Record<string, GiaTri> = {};
  const sau: Record<string, GiaTri> = {};
  for (const truong of TRUONG_LICH_THEO_DOI) {
    if (moi[truong] === undefined) continue;
    const a = chuanHoa(cu[truong]);
    const b = chuanHoa(moi[truong]);
    if (a !== b) {
      truoc[truong] = a;
      sau[truong] = b;
    }
  }
  return Object.keys(sau).length ? { truoc, sau } : null;
}

// Điểm DUY NHẤT sửa 1 buổi học đã tồn tại (import lop_va_lich_hoc, Quản trị
// sửa tay, sau này người hỗ trợ giảng viên — ADR 0004 G12). Kiểm tra nghiệp
// vụ (rule #49/#50, điểm học bắt buộc...) do nơi gọi làm trước.
@Injectable()
export class LichHocThayDoiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
  ) {}

  async capNhat(
    cu: lich_hoc_lop,
    thayDoi: ThayDoiLichHoc,
    opts: { ly_do?: string; nguon: 'sua_tay' | 'import' },
  ): Promise<lich_hoc_lop> {
    const khac = soSanhLichHoc(cu, thayDoi);
    const coTruongKhac =
      (thayDoi.buoi_so !== undefined && thayDoi.buoi_so !== cu.buoi_so) ||
      (thayDoi.trang_thai !== undefined &&
        thayDoi.trang_thai !== cu.trang_thai);
    if (!khac && !coTruongKhac) return cu;

    const capNhat = await this.prisma.lich_hoc_lop.update({
      where: { id: cu.id },
      data: { ...thayDoi, ...(khac ? { cap_nhat_luc: new Date() } : {}) },
    });
    if (khac) {
      await this.nhatKy.ghi({
        hanh_dong: 'sua_lich_hoc',
        mo_ta: `Sửa buổi ${cu.buoi_so}${opts.ly_do ? ` — ${opts.ly_do}` : ''}`,
        chi_tiet: {
          lich_hoc_id: cu.id,
          lop_id: cu.lop_id,
          giai_doan_id: cu.giai_doan_id,
          truoc: khac.truoc,
          sau: khac.sau,
          ly_do: opts.ly_do ?? null,
          nguon: opts.nguon,
        },
      });
    }
    return capNhat;
  }
}
