import {
  Prisma,
  PrismaClient,
  loai_doi_buoi,
  trang_thai_de_nghi,
} from '@prisma/client';
import { chiaLo } from '../../common/utils/theo-lo.util';

// ADR 0014 C5c/C6: dữ liệu "lớp cũ" của học viên khi import phân lớp chuyển
// lớp. Nạp 1 lần cho cả khóa (không theo dòng) — file ~9.000 dòng tra từng
// dòng sẽ 504. Chỉ học viên có đề nghị đổi buổi/học bù còn hiệu lực mới có mặt
// trong Map; issue #36 (điểm danh lớp cũ) mở rộng thêm trường ở đây.

export const GHI_CHU_HUY_CHUYEN_LOP = 'Hủy tự động do chuyển lớp (nhập file)';

const TRANG_THAI_SE_HUY: trang_thai_de_nghi[] = ['cho_duyet', 'da_duyet'];

export interface DeNghiLopCu {
  id: string;
  loai: loai_doi_buoi;
  trang_thai: trang_thai_de_nghi;
  giai_doan_id: string;
  lop_id: string;
  ten_lop: string;
  // Bản đã duyệt mà học viên đã có diem_danh ở buổi chốt.
  da_diem_danh_chot: boolean;
}

export interface LopCuHocVien {
  dang_ky_hoc_id: string;
  // giai_doan_id -> lop_id hiện tại (trước khi ghi file).
  lop_hien_tai: Map<string, string>;
  de_nghi: DeNghiLopCu[];
}

type DbDoc = Pick<PrismaClient, 'doi_buoi_hoc' | 'diem_danh'>;

// Key Map = hoc_vien_id.
export async function napLopCuTheoKhoa(
  prisma: DbDoc,
  where: Prisma.dang_ky_hocWhereInput,
): Promise<Map<string, LopCuHocVien>> {
  const ds = await prisma.doi_buoi_hoc.findMany({
    where: { trang_thai: { in: TRANG_THAI_SE_HUY }, dang_ky_hoc: where },
    select: {
      id: true,
      loai: true,
      trang_thai: true,
      dang_ky_hoc_id: true,
      lich_chot_id: true,
      lich_nguon: {
        select: {
          lop_id: true,
          giai_doan_id: true,
          lop: { select: { ten_lop: true } },
        },
      },
      dang_ky_hoc: {
        select: {
          hoc_vien_id: true,
          phan_lop_giai_doan: { select: { giai_doan_id: true, lop_id: true } },
        },
      },
    },
  });

  const coChot = ds.filter(
    (d) => d.trang_thai === 'da_duyet' && d.lich_chot_id,
  );
  const daDiemDanh = new Set<string>();
  for (const lo of chiaLo(coChot)) {
    const dd = await prisma.diem_danh.findMany({
      where: {
        dang_ky_hoc_id: { in: [...new Set(lo.map((d) => d.dang_ky_hoc_id))] },
        lich_hoc_id: { in: [...new Set(lo.map((d) => d.lich_chot_id!))] },
      },
      select: { dang_ky_hoc_id: true, lich_hoc_id: true },
    });
    dd.forEach((x) => daDiemDanh.add(`${x.dang_ky_hoc_id}|${x.lich_hoc_id}`));
  }

  const kq = new Map<string, LopCuHocVien>();
  for (const d of ds) {
    const hvId = d.dang_ky_hoc.hoc_vien_id;
    let hv = kq.get(hvId);
    if (!hv) {
      hv = {
        dang_ky_hoc_id: d.dang_ky_hoc_id,
        lop_hien_tai: new Map(
          d.dang_ky_hoc.phan_lop_giai_doan.map((p) => [
            p.giai_doan_id,
            p.lop_id,
          ]),
        ),
        de_nghi: [],
      };
      kq.set(hvId, hv);
    }
    hv.de_nghi.push({
      id: d.id,
      loai: d.loai,
      trang_thai: d.trang_thai,
      giai_doan_id: d.lich_nguon.giai_doan_id,
      lop_id: d.lich_nguon.lop_id,
      ten_lop: d.lich_nguon.lop.ten_lop,
      da_diem_danh_chot:
        d.trang_thai === 'da_duyet' &&
        !!d.lich_chot_id &&
        daDiemDanh.has(`${d.dang_ky_hoc_id}|${d.lich_chot_id}`),
    });
  }
  return kq;
}

// C6/C7: chỉ CHUYỂN lớp (lớp mới khác lớp hiện tại) mới hủy; gỡ lớp (null)
// và giữ nguyên lớp thì không. Chỉ đề nghị có buổi nguồn ở đúng lớp hiện tại
// của giai đoạn bị đổi.
export function deNghiSeHuy(
  lopCu: LopCuHocVien | undefined,
  gan: { giai_doan_id: string; lop_id: string | null }[],
  lopHienTai: Map<string, string> | undefined = lopCu?.lop_hien_tai,
): DeNghiLopCu[] {
  if (!lopCu || !lopHienTai) return [];
  return gan.flatMap((g) => {
    const cu = lopHienTai.get(g.giai_doan_id);
    if (!g.lop_id || !cu || cu === g.lop_id) return [];
    return lopCu.de_nghi.filter(
      (d) => d.giai_doan_id === g.giai_doan_id && d.lop_id === cu,
    );
  });
}

// Cảnh báo bước kiểm tra (C5c) — gộp theo giai đoạn.
export function canhBaoHuyDeNghi(
  ma: string,
  ds: DeNghiLopCu[],
  thuTuGiaiDoan: Map<string, number>,
): string[] {
  const theoGd = new Map<string, DeNghiLopCu[]>();
  ds.forEach((d) =>
    theoGd.set(d.giai_doan_id, [...(theoGd.get(d.giai_doan_id) ?? []), d]),
  );
  return [...theoGd.entries()].map(([gdId, nhom]) => {
    const doiBuoi = nhom.filter((d) => d.loai !== 'hoc_bu').length;
    const hocBu = nhom.length - doiBuoi;
    const daHoc = nhom.filter((d) => d.da_diem_danh_chot).length;
    const phan = [
      doiBuoi ? `${doiBuoi} đề nghị đổi buổi` : '',
      hocBu ? `${hocBu} đăng ký học bù` : '',
    ].filter(Boolean);
    return (
      `Học viên "${ma}" chuyển khỏi lớp "${nhom[0].ten_lop}" (GĐ${thuTuGiaiDoan.get(gdId) ?? '?'}): ` +
      `sẽ hủy ${phan.join(', ')}` +
      (daHoc
        ? ` — trong đó ${daHoc} bản đã duyệt học viên đã điểm danh buổi chốt (sau khi hủy không còn tính thay buổi nguồn)`
        : '')
    );
  });
}
