import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { buildMucNlsWorkbook } from '../bao-cao/util/report-excel.util';
import { MucThang, ThangMucService } from '../sso/thang-muc.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { MucNlsQueryDto } from './dto/thong-ke-query.dto';
import { chuanCap, chuanDoiTuong } from './bieu-mau.service';
import { moTaBieuMau } from './mo-ta-bieu-mau';
import { HOC_VIEN_PHAI_KHAO_SAT } from '../common/utils/doi-tuong-khao-sat.util';
import {
  CAP_BIEU_MAU,
  DemMucNls,
  DOI_TUONG_BIEU_MAU,
  DongHocVienMuc,
  LoaiMucNls,
  MucNlsResult,
  MucNlsTongHop,
  MucNlsTruongDong,
} from './thong-ke.types';

const LOAI_PHIEU: Record<LoaiMucNls, string> = {
  dau_vao: 'danh-gia',
  dau_ra: 'dau-ra',
};

const demTrong = (thang: MucThang[]): DemMucNls => ({
  so_hv: 0,
  da_lam: 0,
  chua_lam: 0,
  theo_muc: thang.map((m) => ({ ma: m.ma, nhan: m.nhan, so_luong: 0 })),
  chua_xep_muc: 0,
});

function them(d: DemMucNls, r: DongHocVienMuc) {
  d.so_hv += 1;
  if (!r.da_lam) {
    d.chua_lam += 1;
    return;
  }
  d.da_lam += 1;
  const muc = d.theo_muc.find((m) => m.ma === r.muc_goc);
  if (muc) muc.so_luong += 1;
  else d.chua_xep_muc += 1;
}

const nhomTheo = <K extends string>(khoa: readonly K[], thang: MucThang[]) =>
  Object.fromEntries(khoa.map((k) => [k, demTrong(thang)])) as Record<
    K,
    DemMucNls
  >;

/** Đầu vào đã khử trùng theo hoc_vien_id. */
export function tongHopMucNls(
  rows: DongHocVienMuc[],
  thang: MucThang[],
): MucNlsTongHop {
  const tong = demTrong(thang);
  const theoDoiTuong = nhomTheo(DOI_TUONG_BIEU_MAU, thang);
  const theoCap = nhomTheo(CAP_BIEU_MAU, thang);
  const truong = new Map<string, MucNlsTruongDong>();
  for (const r of rows) {
    let t = truong.get(r.don_vi_id);
    if (!t) {
      t = {
        ...demTrong(thang),
        don_vi_id: r.don_vi_id,
        ten_don_vi: r.ten_don_vi,
        ten_don_vi_cha: r.ten_don_vi_cha,
      };
      truong.set(r.don_vi_id, t);
    }
    them(tong, r);
    them(t, r);
    them(theoDoiTuong[chuanDoiTuong(r.doi_tuong)], r);
    them(theoCap[chuanCap(r.cap_giang_day)], r);
  }
  return {
    thang: thang.map((m) => ({ ma: m.ma, nhan: m.nhan })),
    tong,
    theo_truong: [...truong.values()].sort((a, b) =>
      a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'),
    ),
    theo_doi_tuong: theoDoiTuong,
    theo_cap: theoCap,
  };
}

@Injectable()
export class MucNlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
    private readonly thangMuc: ThangMucService,
  ) {}

  async danhSach(
    user: AuthenticatedUser,
    q: MucNlsQueryDto,
  ): Promise<MucNlsResult> {
    const loai = q.loai ?? 'dau_vao';
    const phamVi = await this.scope.resolve(user, q);
    const thang = await this.thangMuc.thang();
    const rows = phamVi.rong
      ? []
      : await this.layHocVien(phamVi.where, loai, false);
    const { thang: t, tong, theo_truong } = tongHopMucNls(rows, thang);
    return { loai, thang: t, tong, theo_truong };
  }

  async xuatExcel(user: AuthenticatedUser, q: MucNlsQueryDto): Promise<Buffer> {
    const loai = q.loai ?? 'dau_vao';
    const phamVi = await this.scope.resolve(user, q);
    const thang = await this.thangMuc.thang();
    const rows = phamVi.rong
      ? []
      : await this.layHocVien(phamVi.where, loai, true);
    return buildMucNlsWorkbook(
      tongHopMucNls(rows, thang),
      loai,
      rows,
      await moTaBieuMau(this.prisma, q, phamVi.rong),
    );
  }

  private async layHocVien(
    where: Prisma.dang_ky_hocWhereInput,
    loai: LoaiMucNls,
    kemTen: boolean,
  ): Promise<DongHocVienMuc[]> {
    // Nhân viên chưa triển khai khảo sát -> loại khỏi báo cáo "Đánh giá NLS
    // theo mức" (tong/theo_truong/theo_doi_tuong và sheet Đã làm/Chưa làm).
    const dks = await this.prisma.dang_ky_hoc.findMany({
      where: { AND: [where, { hoc_vien: HOC_VIEN_PHAI_KHAO_SAT }] },
      select: {
        hoc_vien_id: true,
        hoc_vien: {
          select: {
            ...(kemTen ? { ho_ten: true } : {}),
            doi_tuong: true,
            cap_giang_day: true,
            don_vi_cong_tac_id: true,
            don_vi_cong_tac: {
              select: {
                ten_don_vi: true,
                don_vi_cha: { select: { ten_don_vi: true } },
              },
            },
            ket_qua_khao_sat: {
              where: { loai: LOAI_PHIEU[loai], trang_thai: 'hoan_thanh' },
              select: { muc_goc: true, hoan_thanh_luc: true },
            },
          },
        },
      },
    });
    const theoHv = new Map<string, DongHocVienMuc>();
    for (const d of dks) {
      if (theoHv.has(d.hoc_vien_id)) continue;
      const h = d.hoc_vien as typeof d.hoc_vien & { ho_ten?: string };
      const kq = h.ket_qua_khao_sat[0];
      theoHv.set(d.hoc_vien_id, {
        hoc_vien_id: d.hoc_vien_id,
        ho_ten: h.ho_ten ?? '',
        doi_tuong: h.doi_tuong,
        cap_giang_day: h.cap_giang_day,
        don_vi_id: h.don_vi_cong_tac_id,
        ten_don_vi: h.don_vi_cong_tac.ten_don_vi,
        ten_don_vi_cha: h.don_vi_cong_tac.don_vi_cha?.ten_don_vi ?? null,
        da_lam: kq !== undefined,
        muc_goc: kq?.muc_goc ?? null,
        hoan_thanh_luc: kq?.hoan_thanh_luc ?? null,
      });
    }
    return [...theoHv.values()];
  }
}
