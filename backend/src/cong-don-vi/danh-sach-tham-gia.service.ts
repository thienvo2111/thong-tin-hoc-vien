import { Injectable } from '@nestjs/common';
import type { giai_doan_tham_gia } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { ScopeService } from '../auth/scope/scope.service';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  TY_LE_SUAT,
  TrangThaiKhop,
  TruongPhamVi,
  TyLeSuat,
  khopTruong,
} from './quy-tac-hop-dong';
import { DongExcelDanhSach, docFileDanhSach } from './danh-sach-tham-gia.excel';
import { DongNapDanhSachDto } from './dto/danh-sach-tham-gia.dto';
import { chuoiSangNgay, ngaySangChuoi } from './dot-trien-khai.service';

export interface DongXemTruoc extends DongExcelDanhSach {
  trang_thai_khop: TrangThaiKhop;
  don_vi_id: string | null;
  ten_don_vi_khop: string | null;
}

export interface KetQuaXemTruoc {
  dong: DongXemTruoc[];
  tong_hop: Record<TrangThaiKhop | 'loi' | 'tong', number>;
}

export interface DongDanhSach {
  id: string;
  don_vi_id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ma_goc: string | null;
  lop: string | null;
  giai_doan: giai_doan_tham_gia;
  ty_le_suat: number;
  ghi_chu: string | null;
  y_kien_truong: string | null;
  hoc_vien_id: string | null;
}

export interface TongHopTruong {
  don_vi_id: string;
  ten_don_vi: string;
  ma_don_vi: string | null;
  so_nguoi: number;
  tong_suat: number;
}

/** Liệt kê số dòng ngắn gọn cho thông báo lỗi. */
function lietKe(soDong: number[]): string {
  const dau = soDong.slice(0, 20).join(', ');
  return soDong.length > 20 ? `${dau}… (${soDong.length} dòng)` : dau;
}

// Issue #58 / ADR 0015 M3, M6, S1, S3, T7: nạp Excel danh sách HSG theo đợt.
@Injectable()
export class DanhSachThamGiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
    private readonly scope: ScopeService,
  ) {}

  /** Trường (loại truong, đang hoạt động) thuộc cây Sở của đợt — phạm vi khớp/chọn tay (T7). */
  async truongTrongPhamVi(dotId: string): Promise<TruongPhamVi[]> {
    const dot = await this.layDot(dotId);
    return this.truongCuaSo(dot.so_gddt_id);
  }

  async xemTruoc(
    dotId: string,
    file: Express.Multer.File | undefined,
  ): Promise<KetQuaXemTruoc> {
    const dot = await this.layDotHsg(dotId);
    if (!file || !file.buffer?.length) {
      throw new ValidationException('Thiếu file tải lên', [
        { field: 'file', message: 'Bắt buộc' },
      ]);
    }
    if (!/\.xlsx$/i.test(file.originalname ?? '')) {
      throw new ValidationException('Chỉ nhận file .xlsx', [
        { field: 'file', message: 'Chỉ nhận file .xlsx' },
      ]);
    }
    const dsExcel = await docFileDanhSach(file.buffer);
    if (dsExcel.length === 0) {
      throw new ValidationException('File không có dòng dữ liệu nào');
    }
    const phamVi = await this.truongCuaSo(dot.so_gddt_id);
    const tenTheoId = new Map(phamVi.map((t) => [t.id, t.ten_don_vi]));

    const tong_hop: KetQuaXemTruoc['tong_hop'] = {
      tong: dsExcel.length,
      khop_ma: 0,
      khop_ten: 0,
      khong_khop: 0,
      thieu_truong: 0,
      nhieu_ket_qua: 0,
      loi: 0,
    };
    const dong = dsExcel.map((d): DongXemTruoc => {
      const kq = khopTruong(d, phamVi);
      tong_hop[kq.trang_thai]++;
      if (d.loi.length > 0) tong_hop.loi++;
      return {
        ...d,
        trang_thai_khop: kq.trang_thai,
        don_vi_id: kq.don_vi_id ?? null,
        ten_don_vi_khop: kq.don_vi_id
          ? (tenTheoId.get(kq.don_vi_id) ?? null)
          : null,
      };
    });
    return { dong, tong_hop };
  }

  /**
   * Nạp các dòng đã gắn trường. "Nạp lại chỉ thay trường có trong file": với mỗi trường có trong
   * payload, xóa danh sách cũ của (đợt, trường) đó rồi thêm mới — trong 1 transaction.
   */
  async nap(dotId: string, ds: DongNapDanhSachDto[], callerId: string) {
    const dot = await this.layDotHsg(dotId);
    const soDong = (d: DongNapDanhSachDto, i: number) => d.so_dong ?? i + 1;

    const thieuTruong = ds
      .map((d, i) => (d.don_vi_id ? null : soDong(d, i)))
      .filter((n): n is number => n !== null);
    if (thieuTruong.length > 0) {
      throw new ValidationException(
        `Dòng chưa gắn trường, không nạp được: ${lietKe(thieuTruong)}`,
      );
    }

    const phamVi = new Set(
      (await this.truongCuaSo(dot.so_gddt_id)).map((t) => t.id),
    );
    const ngoaiPhamVi = ds
      .map((d, i) => (phamVi.has(d.don_vi_id as string) ? null : soDong(d, i)))
      .filter((n): n is number => n !== null);
    if (ngoaiPhamVi.length > 0) {
      throw new ValidationException(
        `Dòng gắn đơn vị không phải trường đang hoạt động trong phạm vi Sở của đợt: ${lietKe(ngoaiPhamVi)}`,
      );
    }

    const lechSuat = ds
      .map((d, i) =>
        d.ty_le_suat === undefined || d.ty_le_suat === TY_LE_SUAT[d.giai_doan]
          ? null
          : soDong(d, i),
      )
      .filter((n): n is number => n !== null);
    if (lechSuat.length > 0) {
      throw new ValidationException(
        `Tỷ lệ suất không khớp giai đoạn tham gia ở dòng: ${lietKe(lechSuat)}`,
      );
    }

    const donViIds = [...new Set(ds.map((d) => d.don_vi_id as string))];
    await this.prisma.$transaction([
      this.prisma.danh_sach_tham_gia.deleteMany({
        where: { dot_trien_khai_id: dot.id, don_vi_id: { in: donViIds } },
      }),
      this.prisma.danh_sach_tham_gia.createMany({
        data: ds.map((d) => ({
          dot_trien_khai_id: dot.id,
          don_vi_id: d.don_vi_id as string,
          ho_ten: d.ho_ten,
          ngay_sinh: chuoiSangNgay(d.ngay_sinh ?? null),
          gioi_tinh: d.gioi_tinh ?? null,
          ma_goc: d.ma_goc ?? null,
          lop: d.lop ?? null,
          giai_doan: d.giai_doan,
          ty_le_suat: TY_LE_SUAT[d.giai_doan],
          ghi_chu: d.ghi_chu ?? null,
          created_by: callerId,
        })),
      }),
    ]);

    const tong_suat = ds.reduce((t, d) => t + TY_LE_SUAT[d.giai_doan], 0);
    const ketQua = {
      so_truong: donViIds.length,
      so_dong: ds.length,
      tong_suat,
    };
    // Không ghi họ tên/ngày sinh vào nhật ký (PII).
    await this.nhatKy.ghi({
      hanh_dong: 'nap_danh_sach_tham_gia',
      chi_tiet: {
        dot_trien_khai_id: dot.id,
        ...ketQua,
        don_vi_ids: donViIds,
      },
    });
    return ketQua;
  }

  /** Danh sách của đợt (lọc 1 trường nếu có) + tổng hợp theo trường của cả đợt. */
  async layDanhSach(dotId: string, donViId?: string) {
    const dot = await this.layDot(dotId);
    const [dong, nhom] = await Promise.all([
      this.prisma.danh_sach_tham_gia.findMany({
        where: {
          dot_trien_khai_id: dot.id,
          ...(donViId ? { don_vi_id: donViId } : {}),
        },
        orderBy: [{ don_vi_id: 'asc' }, { ho_ten: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.danh_sach_tham_gia.groupBy({
        by: ['don_vi_id'],
        where: { dot_trien_khai_id: dot.id },
        _count: { _all: true },
        _sum: { ty_le_suat: true },
      }),
    ]);
    const donVi = await this.prisma.don_vi_cong_tac.findMany({
      where: { id: { in: nhom.map((n) => n.don_vi_id) } },
      select: { id: true, ten_don_vi: true, ma_don_vi: true },
    });
    const theoId = new Map(donVi.map((d) => [d.id, d]));
    const tong_hop: TongHopTruong[] = nhom
      .map((n) => ({
        don_vi_id: n.don_vi_id,
        ten_don_vi: theoId.get(n.don_vi_id)?.ten_don_vi ?? '',
        ma_don_vi: theoId.get(n.don_vi_id)?.ma_don_vi ?? null,
        so_nguoi: n._count._all,
        tong_suat: Number(n._sum.ty_le_suat ?? 0),
      }))
      .sort((a, b) => a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'));

    return {
      tong_hop,
      dong: dong.map((d): DongDanhSach => ({
        id: d.id,
        don_vi_id: d.don_vi_id,
        ho_ten: d.ho_ten,
        ngay_sinh: ngaySangChuoi(d.ngay_sinh),
        gioi_tinh: d.gioi_tinh,
        ma_goc: d.ma_goc,
        lop: d.lop,
        giai_doan: d.giai_doan,
        ty_le_suat: Number(d.ty_le_suat) as TyLeSuat,
        ghi_chu: d.ghi_chu,
        y_kien_truong: d.y_kien_truong,
        hoc_vien_id: d.hoc_vien_id,
      })),
    };
  }

  private async truongCuaSo(soId: string): Promise<TruongPhamVi[]> {
    const ids = await this.scope.collectDescendantIds(soId);
    return this.prisma.don_vi_cong_tac.findMany({
      where: { id: { in: ids }, loai_don_vi: 'truong', trang_thai: 'active' },
      select: { id: true, ma_don_vi: true, ten_don_vi: true },
      orderBy: [{ ten_don_vi: 'asc' }, { id: 'asc' }],
    });
  }

  private async layDot(id: string) {
    const dot = await this.prisma.dot_trien_khai.findUnique({
      where: { id },
      select: { id: true, chuong_trinh: true, so_gddt_id: true },
    });
    if (!dot) throw new NotFoundAppException('Không tìm thấy đợt triển khai');
    return dot;
  }

  // Lát này chỉ nạp Excel cho HSG; NLS chụp từ khóa ở lát sau (ADR 0015 M3).
  private async layDotHsg(id: string) {
    const dot = await this.layDot(id);
    if (dot.chuong_trinh !== 'hsg') {
      throw new ValidationException('Đợt NLS lấy danh sách từ khóa');
    }
    return dot;
  }
}
