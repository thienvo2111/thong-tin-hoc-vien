import { nguon_diem_danh, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CheDoChuyenCan,
  dongDiemDanhBuoi,
  DongDiemDanhBuoi,
  dongDuocChon,
  lopHienTaiTheoDangKy,
  MucLop,
  mucLopTheoPhanLop,
  tinhChuyenCan,
} from '../common/utils/chuyen-can.util';
import { TrangThaiDiemDanh } from '../common/utils/diem-danh-bao-vang.util';
import { DoiBuoiHocQueryService } from './doi-buoi-hoc-query.service';

// ADR 0005 Z8 + ADR 0010 T7: nạp đầu vào cho tinhChuyenCan theo lô (dùng
// chung cho dashboard, tình hình đi học, danh sách lớp/buổi của người hỗ
// trợ) — luật tính nằm DUY NHẤT ở chuyen-can.util.

type DoiBuoiDoc = Pick<
  DoiBuoiHocQueryService,
  'doiBuoiDaDuyetCuaDangKy' | 'lichTomTat'
>;

/**
 * Spec đổi buổi (R7): `${dang_ky_hoc_id}|${lich_chot_id}` → buổi nguồn, để
 * dòng điểm danh ở buổi chốt tính thay buổi nguồn trong tinhChuyenCan.
 */
export async function napDoiTuTheoBuoiChot(
  doiBuoi: DoiBuoiDoc,
  dangKyIds: string[],
): Promise<Map<string, DongDiemDanhBuoi['doi_tu']>> {
  const doi = await doiBuoi.doiBuoiDaDuyetCuaDangKy(dangKyIds);
  if (doi.length === 0) return new Map();
  const nguon = await doiBuoi.lichTomTat(doi.map((d) => d.lich_nguon_id));
  return new Map(
    doi.flatMap((d) => {
      const l = nguon.get(d.lich_nguon_id);
      return l
        ? [
            [
              `${d.dang_ky_hoc_id}|${d.lich_chot_id}`,
              {
                lop_id: l.lop_id,
                giai_doan_id: l.giai_doan_id,
                buoi_so: l.buoi_so,
                muc_nang_luc: l.lop.muc_nang_luc,
              },
            ] as const,
          ]
        : [];
    }),
  );
}

interface DongSql {
  dang_ky_hoc_id: string;
  lich_hoc_id: string;
  trang_thai: TrangThaiDiemDanh;
  nguon: nguon_diem_danh;
  tu_diem_danh_luc: Date | null;
  lop_id: string;
  giai_doan_id: string;
  buoi_so: number;
  loai_lop: string;
  ten_lop: string;
  muc_nang_luc: MucLop;
  che_do_chuyen_can: CheDoChuyenCan;
}

/** Dòng diem_danh đã nạp — lop_id/ten_lop là lớp THẬT của dòng (trước doi_tu). */
export interface DongChuyenCanNap extends DongDiemDanhBuoi {
  lich_hoc_id: string;
  ten_lop: string;
  nguon: nguon_diem_danh;
  tu_diem_danh_luc: Date | null;
}

/** Kết quả tinhChuyenCan của 1 (giai_doan, buoi_so) kèm dòng được chọn. */
export interface KetQuaChuyenCanSlot {
  trang_thai: TrangThaiDiemDanh;
  /** true = dòng của lớp khác lớp hiện tại ở giai đoạn đó (học bù / lớp cũ). */
  tu_lop_cu: boolean;
  dong: DongChuyenCanNap;
}

/** dang_ky_hoc_id → khoaBuoi(giai_doan_id, buoi_so) → kết quả. */
export type ChuyenCanTheoDangKy = Map<string, Map<string, KetQuaChuyenCanSlot>>;

/**
 * Chuyên cần theo tinhChuyenCan cho các đăng ký: mọi dòng diem_danh của đăng
 * ký (mọi lớp), lớp hiện tại theo phan_lop_giai_doan, doi_tu theo đổi buổi
 * đã duyệt còn hiệu lực, chế độ của khóa. Truy vấn tập hợp — không N+1.
 */
export async function napChuyenCan(
  prisma: PrismaService,
  doiBuoi: DoiBuoiDoc,
  dangKyIds: string[],
): Promise<ChuyenCanTheoDangKy> {
  const kq: ChuyenCanTheoDangKy = new Map();
  const ids = [...new Set(dangKyIds)];
  if (ids.length === 0) return kq;
  // 2 truy vấn SQL cho mọi đăng ký (mảng uuid = 1 tham số, không giới hạn
  // bind) — nạp quan hệ qua Prisma (lich_hoc, lop, khoa) chậm ~7 lần ở
  // 7.500 đăng ký.
  const [doiTu, dds, phanLop] = await Promise.all([
    napDoiTuTheoBuoiChot(doiBuoi, ids),
    prisma.$queryRaw<DongSql[]>(Prisma.sql`
      SELECT d.dang_ky_hoc_id, d.lich_hoc_id, d.trang_thai, d.nguon,
             d.tu_diem_danh_luc, l.lop_id, l.giai_doan_id, l.buoi_so,
             lh.loai_lop, lh.ten_lop, lh.muc_nang_luc, k.che_do_chuyen_can
      FROM diem_danh d
      JOIN lich_hoc_lop l ON l.id = d.lich_hoc_id
      JOIN lop_hoc lh ON lh.id = l.lop_id
      JOIN dang_ky_hoc dk ON dk.id = d.dang_ky_hoc_id
      JOIN khoa_boi_duong k ON k.id = dk.khoa_id
      WHERE d.dang_ky_hoc_id = ANY(${ids}::uuid[])`),
    prisma.$queryRaw<
      {
        dang_ky_hoc_id: string;
        giai_doan_id: string;
        lop_id: string;
        muc_nang_luc: MucLop;
      }[]
    >(Prisma.sql`
      SELECT p.dang_ky_hoc_id, p.giai_doan_id, p.lop_id, lh.muc_nang_luc
      FROM phan_lop_giai_doan p
      JOIN lop_hoc lh ON lh.id = p.lop_id
      WHERE p.dang_ky_hoc_id = ANY(${ids}::uuid[])`),
  ]);
  const lopHienTai = lopHienTaiTheoDangKy(phanLop);
  const mucLop = mucLopTheoPhanLop(phanLop);
  const theoDangKy = new Map<
    string,
    { cheDo: CheDoChuyenCan; dong: DongChuyenCanNap[] }
  >();
  for (const d of dds) {
    const nhom = theoDangKy.get(d.dang_ky_hoc_id) ?? {
      cheDo: d.che_do_chuyen_can,
      dong: [],
    };
    nhom.dong.push({
      ...dongDiemDanhBuoi(
        {
          ...d,
          lich_hoc: {
            lop_id: d.lop_id,
            giai_doan_id: d.giai_doan_id,
            buoi_so: d.buoi_so,
            lop: { loai_lop: d.loai_lop, muc_nang_luc: d.muc_nang_luc },
          },
        },
        doiTu,
      ),
      lich_hoc_id: d.lich_hoc_id,
      ten_lop: d.ten_lop,
      nguon: d.nguon,
      tu_diem_danh_luc: d.tu_diem_danh_luc,
    });
    theoDangKy.set(d.dang_ky_hoc_id, nhom);
  }
  for (const [dangKyId, { cheDo, dong }] of theoDangKy) {
    const m = new Map<string, KetQuaChuyenCanSlot>();
    const ketQua = tinhChuyenCan(
      lopHienTai.get(dangKyId) ?? new Map(),
      dong,
      cheDo,
      mucLop,
    );
    for (const [k, r] of ketQua) {
      const goc = dongDuocChon(dong, k, r);
      if (goc) {
        m.set(k, {
          trang_thai: r.trang_thai,
          tu_lop_cu: r.tu_lop_cu,
          dong: goc,
        });
      }
    }
    kq.set(dangKyId, m);
  }
  return kq;
}
