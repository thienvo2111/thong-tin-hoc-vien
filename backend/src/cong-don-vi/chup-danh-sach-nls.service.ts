import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { ScopeService } from '../auth/scope/scope.service';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { chiaLo } from '../common/utils/theo-lo.util';
import {
  BoQua,
  DangKyChup,
  KetQuaChup,
  KhoaChup,
  khoaQuaNhieuGiaiDoan,
  lapBanChup,
  ngaySinhTuHocVien,
  tongHopTheoTruong,
} from './chup-danh-sach-nls';
import { tongSuat } from './quy-tac-hop-dong';
import { chuoiSangNgay, ngaySangChuoi } from './dot-trien-khai.service';
import { DanhSachThamGiaService } from './danh-sach-tham-gia.service';
import {
  Tx,
  khoaNhieuHopDong,
  tuChoiDeNghiCuaDong,
} from './giao-dich-hop-dong';

export const LY_DO_TU_CHOI_CHUP_LAI = 'Quản trị đã chụp lại danh sách từ khóa';
export const LOI_DOT_HSG_CHUP = 'Đợt HSG nạp danh sách bằng Excel';
export const LOI_CHUA_GAN_KHOA =
  'Đợt chưa gắn khóa NLS nào — gắn khóa ở màn Chương trình / Đợt trước';
// ~9.000 ghi danh: xóa + chèn theo lô trong 1 transaction tương tác (nạp HSG 5.000 dòng dùng 30 giây).
const TIMEOUT_CHUP_MS = 60000;
const LO_CHEN = 1000;

export interface TruongXemTruoc {
  don_vi_id: string;
  ten: string;
  ma: string | null;
  so_dong_moi: number;
  so_dong_cu: number;
  tong_suat_moi: number;
  /** X5: đã nộp hợp đồng → chụp giữ nguyên danh sách của trường này. */
  da_nop: boolean;
  co_de_nghi_cho: boolean;
}

export interface XemTruocChup {
  so_khoa: number;
  so_dong: number;
  so_truong: number;
  tong_suat: number;
  /** Mọi trường bị ảnh hưởng: có dòng trong bản chụp mới hoặc đang có dòng trong đợt. */
  truong: TruongXemTruoc[];
  bo_qua: BoQua;
  /** Trường chưa nộp đang có dòng nhưng bản chụp mới không có ai → danh sách thành rỗng. */
  truong_bi_xoa: TruongXemTruoc[];
}

export interface KetQuaLayTuKhoa {
  so_khoa: number;
  so_dong: number;
  so_truong: number;
  bo_qua: BoQua;
  so_dong_da_ghi: number;
  so_truong_da_thay: number;
  so_de_nghi_tu_choi: number;
  giu_nguyen_da_nop: { don_vi_id: string; ten_don_vi: string }[];
}

interface BanChup extends KetQuaChup {
  khoa_ids: string[];
}

// Issue #68 / ADR 0015 M3, M6, S1, S3, X1, X5: "Lấy danh sách từ khóa" — chụp dang_ky_hoc các khóa của đợt NLS
// thành dòng danh sách (không đọc sống). Chụp lại chỉ thay trường chưa nộp hợp đồng.
@Injectable()
export class ChupDanhSachNlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
    private readonly scope: ScopeService,
    private readonly danhSach: DanhSachThamGiaService,
  ) {}

  /** Không ghi gì — số dòng mới/cũ theo trường, trường giữ nguyên (đã nộp), người bị bỏ qua. */
  async xemTruoc(dotId: string): Promise<XemTruocChup> {
    const dot = await this.layDotNls(dotId);
    const chup = await this.tinhBanChup(dot);
    const moi = tongHopTheoTruong(chup.dong);
    const cu = await this.prisma.danh_sach_tham_gia.groupBy({
      by: ['don_vi_id'],
      where: { dot_trien_khai_id: dot.id },
      _count: { _all: true },
    });
    const soCu = new Map(cu.map((c) => [c.don_vi_id, c._count._all]));
    const ids = [...new Set([...moi.keys(), ...soCu.keys()])];
    const [donVi, hopDong, deNghi] = await Promise.all([
      this.prisma.don_vi_cong_tac.findMany({
        where: { id: { in: ids } },
        select: { id: true, ten_don_vi: true, ma_don_vi: true },
      }),
      this.prisma.hop_dong_boi_duong.findMany({
        where: {
          dot_trien_khai_id: dot.id,
          don_vi_id: { in: ids },
          trang_thai_hop_dong: 'da_nop',
        },
        select: { don_vi_id: true },
      }),
      this.prisma.de_nghi_sua_danh_sach.groupBy({
        by: ['don_vi_id'],
        where: {
          dot_trien_khai_id: dot.id,
          don_vi_id: { in: ids },
          trang_thai: 'cho',
        },
      }),
    ]);
    const theoId = new Map(donVi.map((d) => [d.id, d]));
    const daNop = new Set(hopDong.map((h) => h.don_vi_id));
    const coDeNghi = new Set(deNghi.map((d) => d.don_vi_id));
    const truong: TruongXemTruoc[] = ids
      .map((id) => ({
        don_vi_id: id,
        ten: theoId.get(id)?.ten_don_vi ?? '',
        ma: theoId.get(id)?.ma_don_vi ?? null,
        so_dong_moi: moi.get(id)?.so_dong ?? 0,
        so_dong_cu: soCu.get(id) ?? 0,
        tong_suat_moi: moi.get(id)?.tong_suat ?? 0,
        da_nop: daNop.has(id),
        co_de_nghi_cho: coDeNghi.has(id),
      }))
      .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
    return {
      so_khoa: chup.khoa_ids.length,
      so_dong: chup.dong.length,
      so_truong: moi.size,
      tong_suat: tongSuat(chup.dong),
      truong,
      bo_qua: chup.bo_qua,
      truong_bi_xoa: truong.filter(
        (t) => t.so_dong_moi === 0 && t.so_dong_cu > 0 && !t.da_nop,
      ),
    };
  }

  /**
   * Chụp trong 1 transaction: khóa hop_dong mọi trường bị ảnh hưởng (bản chụp mới ∪ đang có dòng). Trường đã
   * nộp (X5) giữ nguyên hoàn toàn. Trường còn lại: tự Từ chối đề nghị sửa/bớt chờ, xóa dòng cũ, chèn dòng mới
   * theo lô, đảm bảo có hop_dong (M5), đặt trạng thái theo X1.
   */
  async layTuKhoa(dotId: string, callerId: string): Promise<KetQuaLayTuKhoa> {
    const dot = await this.layDotNls(dotId);
    const chup = await this.tinhBanChup(dot);
    const truongMoi = [...new Set(chup.dong.map((d) => d.don_vi_id))];

    const kq = await this.prisma.$transaction(
      async (tx) => {
        const coDong = await tx.danh_sach_tham_gia.groupBy({
          by: ['don_vi_id'],
          where: { dot_trien_khai_id: dot.id },
        });
        const anhHuong = [
          ...new Set([...truongMoi, ...coDong.map((c) => c.don_vi_id)]),
        ];
        // Thứ tự khóa như nạp HSG: hop_dong trước, rồi đề nghị / dòng danh sách.
        await this.danhSach.taoHopDongNeuChuaCo(tx, dot.id, truongMoi);
        const daNop = await khoaNhieuHopDong(tx, dot.id, anhHuong);
        const giuNguyen = new Set(daNop);
        const thay = anhHuong.filter((id) => !giuNguyen.has(id));
        const ghi = chup.dong.filter((d) => !giuNguyen.has(d.don_vi_id));
        const tuChoi = await this.thayDanhSach(tx, dot.id, thay, ghi, callerId);
        return { daNop, thay, soDongGhi: ghi.length, tuChoi };
      },
      { timeout: TIMEOUT_CHUP_MS },
    );
    await this.danhSach.ghiTuChoiTuDong(kq.tuChoi);

    const so_bo_qua =
      chup.bo_qua.chua_phan_lop + chup.bo_qua.ngoai_pham_vi.length;
    // Không ghi họ tên vào nhật ký (PII).
    await this.nhatKy.ghi({
      hanh_dong: 'lay_danh_sach_tu_khoa',
      chi_tiet: {
        dot_trien_khai_id: dot.id,
        khoa_ids: chup.khoa_ids,
        so_truong: kq.thay.length,
        so_dong: kq.soDongGhi,
        so_bo_qua,
        giu_nguyen_da_nop: kq.daNop,
      },
    });
    return {
      so_khoa: chup.khoa_ids.length,
      so_dong: chup.dong.length,
      so_truong: truongMoi.length,
      bo_qua: chup.bo_qua,
      so_dong_da_ghi: kq.soDongGhi,
      so_truong_da_thay: kq.thay.length,
      so_de_nghi_tu_choi: kq.tuChoi.length,
      giu_nguyen_da_nop: await this.tenTruong(kq.daNop),
    };
  }

  private async thayDanhSach(
    tx: Tx,
    dotId: string,
    thay: string[],
    ghi: KetQuaChup['dong'],
    callerId: string,
  ) {
    if (thay.length === 0) return [];
    const dongCu = { dot_trien_khai_id: dotId, don_vi_id: { in: thay } };
    // Issue #62: đề nghị sửa/bớt trên dòng sắp bị thay → tự Từ chối; đề nghị thêm người vẫn chờ.
    const tuChoi = await tuChoiDeNghiCuaDong(
      tx,
      dongCu,
      LY_DO_TU_CHOI_CHUP_LAI,
      callerId,
    );
    await tx.danh_sach_tham_gia.deleteMany({ where: dongCu });
    for (const lo of chiaLo(ghi, LO_CHEN)) {
      await tx.danh_sach_tham_gia.createMany({
        data: lo.map((d) => ({
          dot_trien_khai_id: dotId,
          don_vi_id: d.don_vi_id,
          hoc_vien_id: d.hoc_vien_id,
          ho_ten: d.ho_ten,
          ngay_sinh: chuoiSangNgay(d.ngay_sinh),
          gioi_tinh: d.gioi_tinh,
          ma_goc: d.ma_goc,
          lop: d.lop,
          giai_doan: d.giai_doan,
          ty_le_suat: d.ty_le_suat,
          ghi_chu: d.ghi_chu,
          created_by: callerId,
        })),
      });
    }
    await this.danhSach.sauQuanTriSua(tx, dotId, thay, callerId);
    return tuChoi;
  }

  /** Đọc khóa của đợt + ghi danh + phạm vi Sở rồi lập bản chụp (quy tắc thuần). */
  private async tinhBanChup(dot: {
    id: string;
    so_gddt_id: string;
  }): Promise<BanChup> {
    const khoa = await this.prisma.khoa_boi_duong.findMany({
      where: { dot_trien_khai_id: dot.id },
      select: {
        id: true,
        ma_khoa: true,
        thoi_gian_bat_dau: true,
        // Giai đoạn học: có lớp (buổi lịch học hoặc phân lớp), không phải đánh giá.
        giai_doan: {
          where: {
            hinh_thuc: { not: 'danh_gia' },
            OR: [{ lich_hoc: { some: {} } }, { phan_lop: { some: {} } }],
          },
          select: { id: true },
          orderBy: { thu_tu: 'asc' },
        },
      },
      orderBy: [{ thoi_gian_bat_dau: 'asc' }, { ma_khoa: 'asc' }],
    });
    if (khoa.length === 0) {
      throw new ValidationException(LOI_CHUA_GAN_KHOA, [
        { field: 'khoa_ids', message: LOI_CHUA_GAN_KHOA },
      ]);
    }
    const khoaChup: KhoaChup[] = khoa.map((k) => ({
      id: k.id,
      ma_khoa: k.ma_khoa,
      thoi_gian_bat_dau: ngaySangChuoi(k.thoi_gian_bat_dau) as string,
      giai_doan_hoc: k.giai_doan.map((g) => g.id),
    }));
    const quaNhieu = khoaQuaNhieuGiaiDoan(khoaChup);
    if (quaNhieu.length > 0) {
      const message = `Khóa có hơn 2 giai đoạn học, không chụp được (chưa có cách tính giai đoạn tham gia): ${quaNhieu.join(', ')}`;
      throw new ValidationException(
        message,
        quaNhieu.map((ma) => ({ field: 'khoa_ids', message: ma })),
      );
    }
    const khoa_ids = khoa.map((k) => k.id);
    const [dangKy, phamVi] = await Promise.all([
      this.docDangKy(khoa_ids),
      this.scope.collectDescendantIds(dot.so_gddt_id),
    ]);
    return {
      khoa_ids,
      ...lapBanChup(khoaChup, dangKy, new Set(phamVi)),
    };
  }

  private async docDangKy(khoaIds: string[]): Promise<DangKyChup[]> {
    const ds = await this.prisma.dang_ky_hoc.findMany({
      where: { khoa_id: { in: khoaIds }, trang_thai: { not: 'tu_choi' } },
      select: {
        khoa_id: true,
        trang_thai: true,
        hoc_vien: {
          select: {
            id: true,
            ho_ten: true,
            ngay_sinh: true,
            thang_sinh: true,
            nam_sinh: true,
            gioi_tinh: true,
            ma_dinh_danh_moet: true,
            don_vi_cong_tac: {
              select: {
                id: true,
                ten_don_vi: true,
                loai_don_vi: true,
                trang_thai: true,
              },
            },
          },
        },
        phan_lop_giai_doan: {
          select: { giai_doan_id: true, lop: { select: { ten_lop: true } } },
        },
      },
      orderBy: { id: 'asc' },
    });
    return ds.map(({ hoc_vien: hv, ...dk }) => ({
      khoa_id: dk.khoa_id,
      trang_thai: dk.trang_thai,
      hoc_vien: {
        id: hv.id,
        ho_ten: hv.ho_ten,
        ngay_sinh: ngaySinhTuHocVien(hv.ngay_sinh, hv.thang_sinh, hv.nam_sinh),
        gioi_tinh: hv.gioi_tinh,
        ma_dinh_danh_moet: hv.ma_dinh_danh_moet,
        don_vi: hv.don_vi_cong_tac,
      },
      phan_lop: dk.phan_lop_giai_doan.map((p) => ({
        giai_doan_id: p.giai_doan_id,
        ten_lop: p.lop.ten_lop,
      })),
    }));
  }

  private async tenTruong(ids: string[]) {
    if (ids.length === 0) return [];
    const ds = await this.prisma.don_vi_cong_tac.findMany({
      where: { id: { in: ids } },
      select: { id: true, ten_don_vi: true },
    });
    return ds
      .map((d) => ({ don_vi_id: d.id, ten_don_vi: d.ten_don_vi }))
      .sort((a, b) => a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'));
  }

  private async layDotNls(id: string) {
    const dot = await this.prisma.dot_trien_khai.findUnique({
      where: { id },
      select: { id: true, chuong_trinh: true, so_gddt_id: true },
    });
    if (!dot) throw new NotFoundAppException('Không tìm thấy đợt triển khai');
    if (dot.chuong_trinh !== 'nls') {
      throw new ValidationException(LOI_DOT_HSG_CHUP);
    }
    return dot;
  }
}
