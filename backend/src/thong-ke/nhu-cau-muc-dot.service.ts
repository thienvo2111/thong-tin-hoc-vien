import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { TinhHinhDiHocService } from '../tinh-hinh-di-hoc/tinh-hinh-di-hoc.service';
import {
  HOC_VIEN_PHAI_XEP_LOP,
  phaiXepLop,
} from '../common/utils/doi-tuong-khao-sat.util';
import { trangThaiDot } from '../nhu-cau-muc/dot-nhu-cau-muc.service';
import {
  GIAI_DOAN_MOC_ARGS,
  PHAN_LOP_MOC_ARGS,
  TRANG_THAI_DU,
  giaiDoanPhanLop,
} from '../nhu-cau-muc/nhu-cau-muc-hoc-vien.service';
import {
  chonLopDangPhanCong,
  homNayVN,
  tinhMocNhuCau,
} from '../nhu-cau-muc/util/moc-nhu-cau.util';
import { donViLoc, ThongKeScopeService } from './thong-ke-scope.service';
import { moTaBieuMau } from './mo-ta-bieu-mau';
import { NhuCauMucDotQueryDto } from './dto/nhu-cau-muc-dot-query.dto';
import { buildNhuCauMucDotWorkbook } from './nhu-cau-muc-dot-excel.util';
import { tongHopNhuCauMucDot } from './nhu-cau-muc-dot.tong-hop';
import {
  DongNhuCauMucDot,
  DotThongKe,
  NhuCauMucDotResult,
} from './thong-ke.types';

export { tongHopNhuCauMucDot };

const DON_VI_SELECT = {
  id: true,
  ten_don_vi: true,
  loai_don_vi: true,
  don_vi_cha: { select: { id: true, ten_don_vi: true, loai_don_vi: true } },
} satisfies Prisma.don_vi_cong_tacSelect;

const dangKySelect = (dotId: string) =>
  ({
    id: true,
    trang_thai: true,
    muc_dau_vao: true,
    muc_hoc_chon: true,
    hoc_vien: {
      select: {
        ho_ten: true,
        ma_dinh_danh_moet: true,
        so_dien_thoai_lien_he: true,
        doi_tuong: true,
        don_vi_cong_tac: { select: DON_VI_SELECT },
      },
    },
    phan_lop_giai_doan: PHAN_LOP_MOC_ARGS,
    nhu_cau_muc: {
      where: { dot_id: dotId },
      select: {
        muc_chon: true,
        muc_moc: true,
        nguon_moc: true,
        chon_luc: true,
        cap_nhat_luc: true,
        lop_luc_chon: { select: { ten_lop: true } },
      },
    },
  }) satisfies Prisma.dang_ky_hocSelect;

type DangKyRow = Prisma.dang_ky_hocGetPayload<{
  select: ReturnType<typeof dangKySelect>;
}>;
type DonViRow = DangKyRow['hoc_vien']['don_vi_cong_tac'];

/** Trường của học viên: chính đơn vị công tác, hoặc đơn vị cha nếu là trường. */
function truongCua(dv: DonViRow): { id: string; ten: string } | null {
  if (dv.loai_don_vi === 'truong') return { id: dv.id, ten: dv.ten_don_vi };
  const cha = dv.don_vi_cha;
  if (cha?.loai_don_vi === 'truong') return { id: cha.id, ten: cha.ten_don_vi };
  return null;
}

// ADR 0013 D9 — thống kê nhu cầu mức học theo đợt. Chỉ đọc; phạm vi dữ liệu
// do ThongKeScopeService quyết định (khoa_id ép theo đợt).
@Injectable()
export class NhuCauMucDotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
    private readonly nhatKy: NhatKyService,
    private readonly tinhHinhDiHoc: TinhHinhDiHocService,
  ) {}

  async thongKe(
    user: AuthenticatedUser,
    q: NhuCauMucDotQueryDto,
  ): Promise<{ dot: DotThongKe } & NhuCauMucDotResult> {
    const { dot, rows } = await this.napDuLieu(user, q);
    return { dot, ...tongHopNhuCauMucDot(rows) };
  }

  async xuatExcel(
    user: AuthenticatedUser,
    q: NhuCauMucDotQueryDto,
  ): Promise<{ buffer: Buffer; dot: DotThongKe }> {
    const { dot, rows, qKhoa, rong } = await this.napDuLieu(user, q);
    // Số buổi chỉ cần cho Excel (dashboard không tính): 1 lần nạp theo lô.
    const soBuoi = await this.tinhHinhDiHoc.tongTheoDangKy(
      rows.map((r) => r.dang_ky_hoc_id),
    );
    const buffer = await buildNhuCauMucDotWorkbook(
      dot,
      rows,
      await moTaBieuMau(this.prisma, qKhoa, rong),
      soBuoi,
    );
    // File có PII (họ tên, MOET, SĐT) → ghi nhật ký như danh-sach-hoc-vien.
    await this.nhatKy.ghi({
      hanh_dong: 'xuat_nhu_cau_muc_dot',
      nguoi_dung: { id: user.id, vai_tro: user.vai_tro },
      chi_tiet: {
        dot_id: dot.id,
        khoa_id: dot.khoa_id,
        don_vi_ids: donViLoc(q),
        doi_tuong: q.doi_tuong ?? null,
        so_dong: rows.length,
      },
    });
    return { buffer, dot };
  }

  private async napDuLieu(user: AuthenticatedUser, q: NhuCauMucDotQueryDto) {
    const dot = await this.napDot(q.dot_id);
    const qKhoa: NhuCauMucDotQueryDto = { ...q, khoa_id: dot.khoa_id };
    const phamVi = await this.scope.resolve(user, qKhoa);
    const rows = phamVi.rong ? [] : await this.layDong(dot, phamVi.where);
    return { dot, rows, qKhoa, rong: phamVi.rong };
  }

  private async napDot(dotId: string): Promise<DotThongKe> {
    const dot = await this.prisma.dot_nhu_cau_muc.findUnique({
      where: { id: dotId },
      include: { khoa: { select: { ma_khoa: true, ten_khoa: true } } },
    });
    if (!dot) {
      throw new NotFoundAppException('Không tìm thấy đợt nhu cầu mức học');
    }
    return {
      id: dot.id,
      ten_dot: dot.ten_dot,
      khoa_id: dot.khoa_id,
      ma_khoa: dot.khoa.ma_khoa,
      ten_khoa: dot.khoa.ten_khoa,
      mo_luc: dot.mo_luc,
      dong_luc: dot.dong_luc,
      trang_thai: trangThaiDot(dot),
    };
  }

  private async layDong(
    dot: DotThongKe,
    phamVi: Prisma.dang_ky_hocWhereInput,
  ): Promise<DongNhuCauMucDot[]> {
    const [giaiDoan, dks] = await Promise.all([
      this.prisma.giai_doan_khoa.findMany({
        ...GIAI_DOAN_MOC_ARGS,
        where: { ...GIAI_DOAN_MOC_ARGS.where, khoa_id: dot.khoa_id },
      }),
      this.prisma.dang_ky_hoc.findMany({
        where: {
          AND: [
            phamVi,
            { khoa_id: dot.khoa_id },
            {
              OR: [
                {
                  trang_thai: { in: TRANG_THAI_DU },
                  hoc_vien: HOC_VIEN_PHAI_XEP_LOP,
                },
                {
                  nhu_cau_muc: { some: { dot_id: dot.id } },
                  hoc_vien: HOC_VIEN_PHAI_XEP_LOP,
                },
              ],
            },
          ],
        },
        select: dangKySelect(dot.id),
      }),
    ]);
    const homNay = homNayVN();
    const dong: DongNhuCauMucDot[] = [];
    for (const dk of dks) {
      const gds = giaiDoanPhanLop(giaiDoan, dk.phan_lop_giai_doan);
      const moc = tinhMocNhuCau(gds, dk.muc_dau_vao, homNay);
      const lc = dk.nhu_cau_muc[0] ?? null;
      // Nhân viên không bao giờ vào thống kê, kể cả đã chọn trước đó (R4).
      if (!phaiXepLop(dk.hoc_vien.doi_tuong)) continue;
      const duDieuKien = TRANG_THAI_DU.includes(dk.trang_thai) && moc !== null;
      if (!duDieuKien && !lc) continue;
      const h = dk.hoc_vien;
      dong.push({
        dang_ky_hoc_id: dk.id,
        hoc_vien: {
          ho_ten: h.ho_ten,
          ma_moet: h.ma_dinh_danh_moet,
          so_dien_thoai: h.so_dien_thoai_lien_he,
          don_vi: {
            id: h.don_vi_cong_tac.id,
            ten: h.don_vi_cong_tac.ten_don_vi,
          },
          truong: truongCua(h.don_vi_cong_tac),
        },
        moc_hien_tai: moc,
        lop_hien_tai: chonLopDangPhanCong(gds, homNay)?.lop?.ten_lop ?? null,
        muc_dau_vao: dk.muc_dau_vao,
        muc_hoc_chon: dk.muc_hoc_chon,
        lua_chon: lc
          ? {
              muc_chon: lc.muc_chon,
              muc_moc: lc.muc_moc,
              nguon_moc: lc.nguon_moc,
              lop_luc_chon: lc.lop_luc_chon?.ten_lop ?? null,
              chon_luc: lc.chon_luc,
              cap_nhat_luc: lc.cap_nhat_luc,
            }
          : null,
      });
    }
    return dong.sort(
      (a, b) =>
        (a.hoc_vien.truong ?? a.hoc_vien.don_vi).ten.localeCompare(
          (b.hoc_vien.truong ?? b.hoc_vien.don_vi).ten,
          'vi',
        ) || a.hoc_vien.ho_ten.localeCompare(b.hoc_vien.ho_ten, 'vi'),
    );
  }
}
