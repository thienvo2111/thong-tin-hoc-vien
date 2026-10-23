import {
  Prisma,
  PrismaClient,
  loai_doi_buoi,
  trang_thai_de_nghi,
} from '@prisma/client';
import { chiaLo } from '../../common/utils/theo-lo.util';
import {
  CheDoChuyenCan,
  MucLop,
  congNhanLopKhac,
} from '../../common/utils/chuyen-can.util';

// ADR 0014 C5c/C6: dữ liệu "lớp cũ" của học viên khi import phân lớp chuyển
// lớp. Nạp 1 lần cho cả khóa (không theo dòng) — file ~9.000 dòng tra từng
// dòng sẽ 504. Chỉ học viên có đề nghị đổi buổi/học bù còn hiệu lực mới có mặt
// trong Map. Điểm danh lớp cũ (#36): napDiemDanhLopCu bên dưới.

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

// ---------------------------------------------------------------------
// ADR 0014 C5a/C5b (issue #36): số buổi đã điểm danh ở lớp hiện tại (trước
// khi ghi file) theo (học viên, giai đoạn) — 1 truy vấn gộp cho cả khóa, chỉ
// có dòng khi đã điểm danh ≥ 1 buổi (mọi trạng thái).

export interface DiemDanhLopCu {
  lop_id: string;
  ten_lop: string;
  loai_lop: string;
  muc_nang_luc: MucLop;
  so_buoi: number;
}

export interface DiemDanhLopCuKhoa {
  che_do: CheDoChuyenCan;
  // hoc_vien_id -> giai_doan_id -> lớp hiện tại kèm số buổi đã điểm danh.
  theo_hoc_vien: Map<string, Map<string, DiemDanhLopCu>>;
}

// hocVienId: chỉ nạp 1 học viên (commitPhanLop gọi ngoài lượt import).
export async function napDiemDanhLopCu(
  prisma: Pick<PrismaClient, '$queryRaw' | 'khoa_boi_duong'>,
  khoaId: string,
  hocVienId?: string,
): Promise<DiemDanhLopCuKhoa> {
  const locHocVien = hocVienId
    ? Prisma.sql`AND dk.hoc_vien_id = ${hocVienId}::uuid`
    : Prisma.empty;
  const [khoa, dong] = await Promise.all([
    prisma.khoa_boi_duong.findUnique({
      where: { id: khoaId },
      select: { che_do_chuyen_can: true },
    }),
    prisma.$queryRaw<
      (DiemDanhLopCu & { hoc_vien_id: string; giai_doan_id: string })[]
    >`
      SELECT dk.hoc_vien_id, pl.giai_doan_id, pl.lop_id, l.ten_lop,
             l.loai_lop::text AS loai_lop, l.muc_nang_luc::text AS muc_nang_luc,
             COUNT(DISTINCT lh.id)::int AS so_buoi
      FROM phan_lop_giai_doan pl
      JOIN dang_ky_hoc dk ON dk.id = pl.dang_ky_hoc_id
      JOIN lop_hoc l ON l.id = pl.lop_id
      JOIN lich_hoc_lop lh
        ON lh.lop_id = pl.lop_id AND lh.giai_doan_id = pl.giai_doan_id
      JOIN diem_danh dd
        ON dd.lich_hoc_id = lh.id AND dd.dang_ky_hoc_id = dk.id
      WHERE dk.khoa_id = ${khoaId}::uuid ${locHocVien}
      GROUP BY dk.hoc_vien_id, pl.giai_doan_id, pl.lop_id, l.ten_lop,
               l.loai_lop, l.muc_nang_luc`,
  ]);
  const theo_hoc_vien = new Map<string, Map<string, DiemDanhLopCu>>();
  for (const { hoc_vien_id, giai_doan_id, ...d } of dong) {
    const m = theo_hoc_vien.get(hoc_vien_id) ?? new Map();
    m.set(giai_doan_id, d);
    theo_hoc_vien.set(hoc_vien_id, m);
  }
  return {
    che_do: khoa?.che_do_chuyen_can ?? 'theo_lop_hien_tai',
    theo_hoc_vien,
  };
}

// Kết luận công nhận dùng đúng quy tắc của tinhChuyenCan (trực tiếp luôn
// tính; lớp Zoom khác theo congNhanLopKhac).
export function congNhanDiemDanhLopCu(
  cheDo: CheDoChuyenCan,
  cu: DiemDanhLopCu,
  mucLopMoi: MucLop | undefined,
): boolean {
  return (
    cu.loai_lop === 'truc_tiep' ||
    congNhanLopKhac(cheDo, cu.muc_nang_luc, mucLopMoi)
  );
}

export function canhBaoDiemDanhLopCu(
  ma: string,
  gan: { giai_doan_id: string; lop_id: string | null }[],
  lopMoi: Map<string, { ten_lop: string; muc_nang_luc: MucLop }>,
  diemDanh: DiemDanhLopCuKhoa,
  hocVienId: string,
  thuTuGiaiDoan: Map<string, number>,
): string[] {
  const cuaHv = diemDanh.theo_hoc_vien.get(hocVienId);
  if (!cuaHv) return [];
  return gan.flatMap((g) => {
    const cu = cuaHv.get(g.giai_doan_id);
    if (!cu || cu.lop_id === g.lop_id) return [];
    const gd = `GĐ${thuTuGiaiDoan.get(g.giai_doan_id) ?? '?'}`;
    const daDiemDanh = `đã điểm danh ${cu.so_buoi} buổi ở lớp "${cu.ten_lop}"`;
    if (g.lop_id === null) {
      return [
        `Học viên "${ma}" gỡ khỏi lớp "${cu.ten_lop}" (${gd}): ${daDiemDanh} — điểm danh vẫn được giữ`,
      ];
    }
    const moi = lopMoi.get(g.giai_doan_id);
    const congNhan = congNhanDiemDanhLopCu(
      diemDanh.che_do,
      cu,
      moi?.muc_nang_luc,
    );
    const ketLuan = congNhan
      ? 'được công nhận'
      : diemDanh.che_do === 'cong_nhan_cung_muc'
        ? 'không được công nhận (khác mức)'
        : 'không được công nhận';
    return [
      `Học viên "${ma}" chuyển từ lớp "${cu.ten_lop}" sang lớp "${moi?.ten_lop ?? '?'}" (${gd}): ${daDiemDanh} — theo chế độ của khóa: ${ketLuan}`,
    ];
  });
}

// Tên nấc ngắn cho nhật ký (ghi nấc TẠI THỜI ĐIỂM chuyển lớp).
export const NHAN_NAC_CHUYEN_CAN: Record<CheDoChuyenCan, string> = {
  theo_lop_hien_tai: 'theo lớp hiện tại',
  cong_nhan_cung_muc: 'cùng mức',
  cong_nhan_lop_cu: 'bất kể mức',
};

// Phần đuôi nhật ký "Phân lớp" (nhập file) của 1 giai đoạn đổi lớp: điểm
// danh ở lớp cũ + kết luận công nhận, và số đề nghị bị hủy (C6). Rỗng khi
// không có gì để nói.
export function phuLucNhatKyPhanLop(
  g: { giai_doan_id: string; lop_id: string | null },
  cu: DiemDanhLopCu | undefined,
  cheDo: CheDoChuyenCan | undefined,
  mucLopMoi: MucLop | undefined,
  huy: DeNghiLopCu[],
): { duoi: string; chi_tiet?: Record<string, unknown> } {
  const phan: string[] = [];
  const chiTiet: Record<string, unknown> = {};
  if (cu && cheDo && cu.lop_id !== g.lop_id) {
    if (g.lop_id === null) {
      phan.push(`đã điểm danh ${cu.so_buoi} buổi, điểm danh vẫn được giữ`);
      chiTiet.diem_danh_lop_cu = { so_buoi: cu.so_buoi, cong_nhan: null };
    } else {
      const congNhan = congNhanDiemDanhLopCu(cheDo, cu, mucLopMoi);
      phan.push(
        `đã điểm danh ${cu.so_buoi} buổi ở lớp ${cu.ten_lop}, ` +
          `${congNhan ? 'được' : 'không được'} công nhận (nấc: ${NHAN_NAC_CHUYEN_CAN[cheDo]})`,
      );
      chiTiet.diem_danh_lop_cu = {
        so_buoi: cu.so_buoi,
        cong_nhan: congNhan,
        che_do_chuyen_can: cheDo,
      };
    }
  }
  const huyGd = huy.filter((d) => d.giai_doan_id === g.giai_doan_id);
  if (huyGd.length > 0) {
    const hocBu = huyGd.filter((d) => d.loai === 'hoc_bu').length;
    const doiBuoi = huyGd.length - hocBu;
    phan.push(
      'hủy ' +
        [doiBuoi ? `${doiBuoi} đổi buổi` : '', hocBu ? `${hocBu} học bù` : '']
          .filter(Boolean)
          .join(', '),
    );
    chiTiet.huy_de_nghi = {
      doi_buoi: doiBuoi,
      hoc_bu: hocBu,
      ids: huyGd.map((d) => d.id),
    };
  }
  if (phan.length === 0) return { duoi: '' };
  return {
    duoi: ` — ${phan.join('; ')}`,
    chi_tiet: { giai_doan_id: g.giai_doan_id, nguon: 'nhap_file', ...chiTiet },
  };
}
