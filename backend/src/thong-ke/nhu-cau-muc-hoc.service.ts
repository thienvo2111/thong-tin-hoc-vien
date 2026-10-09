import { Injectable } from '@nestjs/common';
import { Prisma, muc_nang_luc } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { buildNhuCauMucHocWorkbook } from '../bao-cao/util/report-excel.util';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';
import { moTaBieuMau } from './mo-ta-bieu-mau';
import {
  LOAI_BAI_DAU_VAO,
  THU_TU_MUC,
  mucDanhGiaLamMoc,
} from '../khoa-boi-duong/util/muc-hoc.util';
import {
  DongDangKyNhuCauMuc,
  NhuCauMucHocResult,
  NhuCauMucHocTheoMuc,
  NhuCauMucHocTruongDong,
} from './thong-ke.types';

const MUC_THEO_THU_TU: muc_nang_luc[] = ['co_ban', 'thanh_thao', 'nang_cao'];
const NHAN_MUC: Record<muc_nang_luc, string> = {
  co_ban: 'Cơ bản',
  thanh_thao: 'Thành thạo',
  nang_cao: 'Nâng cao',
};

/** Bộ đếm trung gian — dùng chung cho tổng và từng trường. */
interface MucAcc {
  so_dang_ky: number;
  chua_co_muc: number;
  da_dieu_chinh: number;
  moc_tu_khao_sat: number;
  theo_danh_gia: Map<muc_nang_luc, number>;
  theo_nhu_cau: Map<muc_nang_luc, number>;
}

const accTrong = (): MucAcc => ({
  so_dang_ky: 0,
  chua_co_muc: 0,
  da_dieu_chinh: 0,
  moc_tu_khao_sat: 0,
  theo_danh_gia: new Map(),
  theo_nhu_cau: new Map(),
});

function them(
  acc: MucAcc,
  r: Pick<DongDangKyNhuCauMuc, 'muc_danh_gia' | 'nguon_muc' | 'muc_hoc_chon'>,
): void {
  acc.so_dang_ky += 1;
  if (!r.muc_danh_gia) {
    acc.chua_co_muc += 1;
    return;
  }
  if (r.nguon_muc === 'khao_sat') acc.moc_tu_khao_sat += 1;
  acc.theo_danh_gia.set(
    r.muc_danh_gia,
    (acc.theo_danh_gia.get(r.muc_danh_gia) ?? 0) + 1,
  );
  const hieuLuc = r.muc_hoc_chon ?? r.muc_danh_gia;
  acc.theo_nhu_cau.set(hieuLuc, (acc.theo_nhu_cau.get(hieuLuc) ?? 0) + 1);
  if (r.muc_hoc_chon && r.muc_hoc_chon !== r.muc_danh_gia) {
    acc.da_dieu_chinh += 1;
  }
}

const theoMucTu = (acc: MucAcc): NhuCauMucHocTheoMuc[] =>
  MUC_THEO_THU_TU.map((muc) => ({
    muc,
    nhan: NHAN_MUC[muc],
    theo_danh_gia: acc.theo_danh_gia.get(muc) ?? 0,
    theo_nhu_cau: acc.theo_nhu_cau.get(muc) ?? 0,
  }));

/**
 * Tổng hợp "nhu cầu mức học" từ các lượt đăng ký (dang_ky_hoc) — mỗi dòng là 1 lượt, không
 * khử trùng học viên. Hàm thuần, không phụ thuộc Prisma, dễ unit test.
 */
export function tongHopNhuCauMucHoc(
  rows: DongDangKyNhuCauMuc[],
): NhuCauMucHocResult {
  const tong = accTrong();
  const dieuChinh = new Map<string, number>();
  const truong = new Map<
    string,
    { acc: MucAcc; ten_don_vi: string; ten_don_vi_cha: string | null }
  >();

  for (const r of rows) {
    them(tong, r);
    if (r.muc_danh_gia && r.muc_hoc_chon && r.muc_hoc_chon !== r.muc_danh_gia) {
      const khoa = `${r.muc_danh_gia}|${r.muc_hoc_chon}`;
      dieuChinh.set(khoa, (dieuChinh.get(khoa) ?? 0) + 1);
    }
    let t = truong.get(r.don_vi_id);
    if (!t) {
      t = {
        acc: accTrong(),
        ten_don_vi: r.ten_don_vi,
        ten_don_vi_cha: r.ten_don_vi_cha,
      };
      truong.set(r.don_vi_id, t);
    }
    them(t.acc, r);
  }

  const dieu_chinh = [...dieuChinh.entries()]
    .map(([khoa, so_luong]) => {
      const [tu, den] = khoa.split('|') as [muc_nang_luc, muc_nang_luc];
      return { tu, den, so_luong };
    })
    .sort(
      (a, b) =>
        THU_TU_MUC[b.tu] - THU_TU_MUC[a.tu] ||
        THU_TU_MUC[b.den] - THU_TU_MUC[a.den],
    );

  const theo_truong: NhuCauMucHocTruongDong[] = [...truong.entries()]
    .map(([don_vi_id, t]) => ({
      don_vi_id,
      ten_don_vi: t.ten_don_vi,
      ten_don_vi_cha: t.ten_don_vi_cha,
      so_dang_ky: t.acc.so_dang_ky,
      chua_co_muc: t.acc.chua_co_muc,
      da_dieu_chinh: t.acc.da_dieu_chinh,
      moc_tu_khao_sat: t.acc.moc_tu_khao_sat,
      theo_muc: theoMucTu(t.acc),
    }))
    .sort((a, b) => a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'));

  return {
    so_dang_ky: tong.so_dang_ky,
    chua_co_muc: tong.chua_co_muc,
    da_dieu_chinh: tong.da_dieu_chinh,
    moc_tu_khao_sat: tong.moc_tu_khao_sat,
    theo_muc: theoMucTu(tong),
    dieu_chinh,
    theo_truong,
  };
}

@Injectable()
export class NhuCauMucHocService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
  ) {}

  async danhSach(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<NhuCauMucHocResult> {
    const { where, rong } = await this.scope.resolve(user, q);
    const rows = rong ? [] : await this.layDangKy(where, false);
    return tongHopNhuCauMucHoc(rows);
  }

  async xuatExcel(user: AuthenticatedUser, q: ThongKeQueryDto): Promise<Buffer> {
    const phamVi = await this.scope.resolve(user, q);
    const rows = phamVi.rong ? [] : await this.layDangKy(phamVi.where, true);
    return buildNhuCauMucHocWorkbook(
      tongHopNhuCauMucHoc(rows),
      rows,
      await moTaBieuMau(this.prisma, q, phamVi.rong),
    );
  }

  private async layDangKy(
    where: Prisma.dang_ky_hocWhereInput,
    kemTen: boolean,
  ): Promise<DongDangKyNhuCauMuc[]> {
    const dks = await this.prisma.dang_ky_hoc.findMany({
      where,
      select: {
        muc_dau_vao: true,
        muc_hoc_chon: true,
        muc_hoc_chon_luc: true,
        hoc_vien: {
          select: {
            don_vi_cong_tac_id: true,
            don_vi_cong_tac: {
              select: {
                ten_don_vi: true,
                don_vi_cha: { select: { ten_don_vi: true } },
              },
            },
            ket_qua_khao_sat: {
              where: { loai: LOAI_BAI_DAU_VAO },
              select: { trang_thai: true, muc: true, muc_goc: true },
            },
            ...(kemTen ? { ho_ten: true, ma_dinh_danh_moet: true } : {}),
          },
        },
        ...(kemTen ? { khoa: { select: { ma_khoa: true, ten_khoa: true } } } : {}),
      },
    });
    return dks.map((d) => {
      const h = d.hoc_vien as typeof d.hoc_vien & {
        ho_ten?: string;
        ma_dinh_danh_moet?: string | null;
      };
      const k = (d as typeof d & { khoa?: { ma_khoa: string; ten_khoa: string } })
        .khoa;
      const mocDanhGia = mucDanhGiaLamMoc(
        d.muc_dau_vao,
        h.ket_qua_khao_sat[0] ?? null,
      );
      return {
        muc_danh_gia: mocDanhGia.muc,
        nguon_muc: mocDanhGia.nguon,
        muc_hoc_chon: d.muc_hoc_chon,
        muc_hoc_chon_luc: d.muc_hoc_chon_luc,
        don_vi_id: h.don_vi_cong_tac_id,
        ten_don_vi: h.don_vi_cong_tac.ten_don_vi,
        ten_don_vi_cha: h.don_vi_cong_tac.don_vi_cha?.ten_don_vi ?? null,
        ho_ten: h.ho_ten ?? '',
        ma_dinh_danh_moet: h.ma_dinh_danh_moet ?? null,
        ma_khoa: k?.ma_khoa ?? '',
        ten_khoa: k?.ten_khoa ?? '',
      };
    });
  }
}
