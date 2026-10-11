import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import {
  MucThang,
  nhanMucGoc,
  ThangMucService,
} from '../sso/thang-muc.service';
import { phaiKhaoSat } from '../common/utils/doi-tuong-khao-sat.util';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';
import { donViLoc, ThongKeScopeService } from './thong-ke-scope.service';
import { moTaBieuMau } from './mo-ta-bieu-mau';
import {
  buildDanhSachHocVienWorkbook,
  DongDanhSachHocVien,
  TinhTrangPhieu,
} from './danh-sach-hoc-vien-excel.util';

const SELECT_DONG = {
  hoc_vien_id: true,
  khoa: { select: { ten_khoa: true } },
  hoc_vien: {
    select: {
      ma_dinh_danh_moet: true,
      ho_ten: true,
      ngay_sinh: true,
      thang_sinh: true,
      nam_sinh: true,
      gioi_tinh: true,
      doi_tuong: true,
      cap_giang_day: true,
      so_dien_thoai_lien_he: true,
      email_lien_he: true,
      don_vi_cong_tac: {
        select: {
          ten_don_vi: true,
          don_vi_cha: { select: { ten_don_vi: true } },
        },
      },
      nguoi_dung_account: { select: { dang_nhap_lan_cuoi: true } },
      ket_qua_khao_sat: {
        where: { loai: { in: ['khao-sat', 'danh-gia'] } },
        select: {
          loai: true,
          trang_thai: true,
          muc_goc: true,
          hoan_thanh_luc: true,
        },
      },
    },
  },
} satisfies Prisma.dang_ky_hocSelect;

type DangKyRow = Prisma.dang_ky_hocGetPayload<{ select: typeof SELECT_DONG }>;
type Phieu = DangKyRow['hoc_vien']['ket_qua_khao_sat'][number];

function tinhTrang(p: Phieu | undefined): Exclude<TinhTrangPhieu, null> {
  if (!p) return 'chua_lam';
  if (p.trang_thai === 'hoan_thanh') return 'da_lam';
  return p.trang_thai === 'dang_lam' ? 'dang_lam' : 'chua_lam';
}

/** Gộp các đăng ký học về 1 dòng/học viên (khóa nối bằng "; "). */
export function gopTheoHocVien(
  rows: DangKyRow[],
  thang: MucThang[],
): DongDanhSachHocVien[] {
  const theoHv = new Map<string, DongDanhSachHocVien>();
  for (const r of rows) {
    const cu = theoHv.get(r.hoc_vien_id);
    if (cu) {
      if (!cu.ten_khoa.includes(r.khoa.ten_khoa))
        cu.ten_khoa.push(r.khoa.ten_khoa);
      continue;
    }
    const h = r.hoc_vien;
    const apDung = phaiKhaoSat(h.doi_tuong);
    const ks = h.ket_qua_khao_sat.find((k) => k.loai === 'khao-sat');
    const dg = h.ket_qua_khao_sat.find((k) => k.loai === 'danh-gia');
    const dgXong = apDung && dg?.trang_thai === 'hoan_thanh';
    theoHv.set(r.hoc_vien_id, {
      ma_dinh_danh_moet: h.ma_dinh_danh_moet,
      ho_ten: h.ho_ten,
      ngay_sinh: h.ngay_sinh,
      thang_sinh: h.thang_sinh,
      nam_sinh: h.nam_sinh,
      gioi_tinh: h.gioi_tinh,
      ten_don_vi: h.don_vi_cong_tac.ten_don_vi,
      ten_don_vi_cha: h.don_vi_cong_tac.don_vi_cha?.ten_don_vi ?? null,
      doi_tuong: h.doi_tuong,
      cap_giang_day: h.cap_giang_day,
      so_dien_thoai: h.so_dien_thoai_lien_he,
      email: h.email_lien_he,
      ten_khoa: [r.khoa.ten_khoa],
      dang_nhap_lan_cuoi: h.nguoi_dung_account?.dang_nhap_lan_cuoi ?? null,
      ky_nang_so: apDung ? tinhTrang(ks) : null,
      danh_gia_nls: apDung ? tinhTrang(dg) : null,
      muc_danh_gia: dgXong ? nhanMucGoc(dg.muc_goc, thang) : null,
      danh_gia_hoan_thanh_luc: dgXong ? dg.hoan_thanh_luc : null,
    });
  }
  return [...theoHv.values()].sort(
    (a, b) =>
      a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi') ||
      a.ho_ten.localeCompare(b.ho_ten, 'vi'),
  );
}

@Injectable()
export class DanhSachHocVienService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
    private readonly thangMuc: ThangMucService,
    private readonly nhatKy: NhatKyService,
  ) {}

  async xuatExcel(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<Buffer> {
    const phamVi = await this.scope.resolve(user, q);
    const [thang, moTa, rows] = await Promise.all([
      this.thangMuc.thang(),
      moTaBieuMau(this.prisma, q, phamVi.rong),
      phamVi.rong
        ? Promise.resolve([] as DangKyRow[])
        : this.prisma.dang_ky_hoc.findMany({
            where: phamVi.where,
            select: SELECT_DONG,
          }),
    ]);
    const dong = gopTheoHocVien(rows, thang);
    const buffer = await buildDanhSachHocVienWorkbook(moTa, dong);
    await this.nhatKy.ghi({
      hanh_dong: 'xuat_danh_sach_hoc_vien_tong_hop',
      nguoi_dung: { id: user.id, vai_tro: user.vai_tro },
      chi_tiet: {
        khoa_id: q.khoa_id ?? null,
        don_vi_ids: donViLoc(q),
        cum_id: q.cum_id ?? null,
        doi_tuong: q.doi_tuong ?? null,
        so_dong: dong.length,
      },
    });
    return buffer;
  }
}
