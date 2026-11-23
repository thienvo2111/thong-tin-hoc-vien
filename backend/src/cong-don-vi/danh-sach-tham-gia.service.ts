import { Injectable } from '@nestjs/common';
import type {
  danh_sach_tham_gia,
  giai_doan_tham_gia,
  trang_thai_danh_sach_truong,
  trang_thai_hop_dong,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { ScopeService } from '../auth/scope/scope.service';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  TY_LE_SUAT,
  TrangThaiKhop,
  TruongPhamVi,
  TyLeSuat,
  khopTruong,
  trangThaiSauQuanTriSua,
} from './quy-tac-hop-dong';
import {
  DongExcelDanhSach,
  docFileDanhSach,
  taoFileXuatDanhSach,
} from './danh-sach-tham-gia.excel';
import {
  DongNapDanhSachDto,
  SuaDongDanhSachDto,
  ThemDongDanhSachDto,
} from './dto/danh-sach-tham-gia.dto';
import { chuoiSangNgay, ngaySangChuoi } from './dot-trien-khai.service';
import {
  DongDanhSachGoc,
  apDungSua,
  khacBiet,
  tenFileXuatDanhSach,
} from './sua-dong-danh-sach';
import {
  DeNghiTuDongTuChoi,
  Tx,
  datTrangThaiTheoSaiLech,
  khoaNhieuHopDong,
  khoaNhieuHopDongChuaNop,
  tuChoiDeNghiCuaDong,
} from './giao-dich-hop-dong';

export interface DongXemTruoc extends DongExcelDanhSach {
  trang_thai_khop: TrangThaiKhop;
  don_vi_id: string | null;
  ten_don_vi_khop: string | null;
  /** Issue #64 / X5: trường khớp đã nộp hợp đồng — nạp sẽ bị chặn tới khi Mở lại. */
  da_nop: boolean;
}

export interface KetQuaXemTruoc {
  dong: DongXemTruoc[];
  tong_hop: Record<TrangThaiKhop | 'loi' | 'tong', number>;
  /** Issue #64 / X5: mọi trường của đợt đã nộp hợp đồng (kể cả trường chọn tay ở bước xem trước). */
  truong_da_nop: { don_vi_id: string; ten_don_vi: string }[];
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
  /** Issue #62: dòng đang có đề nghị sửa/bớt chờ HCMUE xử lý. */
  co_de_nghi_cho?: boolean;
}

export interface TongHopTruong {
  don_vi_id: string;
  ten_don_vi: string;
  ma_don_vi: string | null;
  so_nguoi: number;
  tong_suat: number;
  /** Issue #61 / X1: trạng thái danh sách của trường (null nếu chưa có dòng hợp đồng). */
  trang_thai_danh_sach: trang_thai_danh_sach_truong | null;
  /** Issue #62: số đề nghị chờ của trường (mọi loại). */
  so_de_nghi_cho: number;
  /** Issue #64 / X5: đã nộp → Quản trị không sửa được danh sách trường này tới khi Mở lại. */
  trang_thai_hop_dong: trang_thai_hop_dong | null;
}

export function giaTriGoc(d: danh_sach_tham_gia): DongDanhSachGoc {
  return {
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
  };
}

function toDongDanhSach(d: danh_sach_tham_gia): DongDanhSach {
  return { id: d.id, ...giaTriGoc(d), hoc_vien_id: d.hoc_vien_id };
}

/** Bản chụp cả dòng cho nhật ký thêm/xóa. */
export function banChup(d: danh_sach_tham_gia) {
  return { ...giaTriGoc(d), hoc_vien_id: d.hoc_vien_id };
}

const KHONG_THAY_DONG = 'Không tìm thấy dòng danh sách';
// Issue #62: lý do tự Từ chối đề nghị khi Quản trị xóa / nạp lại dòng.
export const LY_DO_TU_CHOI_XOA_DONG = 'Quản trị đã xóa dòng này';
export const LY_DO_TU_CHOI_NAP_LAI = 'Quản trị đã nạp lại danh sách của trường';
export const DA_NOP_NAP_LAI =
  'Trường đã nộp hợp đồng — Mở lại hợp đồng trước khi nạp lại';
// Nạp lại tới 5.000 dòng trong 1 transaction tương tác.
const TIMEOUT_NAP_MS = 30000;

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
    const truong_da_nop = await this.truongDaNop(dot.id);
    const daNop = new Set(truong_da_nop.map((t) => t.don_vi_id));

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
        da_nop: kq.don_vi_id ? daNop.has(kq.don_vi_id) : false,
      };
    });
    return { dong, tong_hop, truong_da_nop };
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
    // Dòng hop_dong trước (tạo nếu thiếu + khóa FOR UPDATE) rồi mới đến đề nghị / dòng danh sách — cùng thứ
    // tự khóa với thao tác của trường, tránh deadlock.
    const tuChoi = await this.prisma.$transaction(
      async (tx) => {
        await this.taoHopDongNeuChuaCo(tx, dot.id, donViIds);
        const daNop = await khoaNhieuHopDong(tx, dot.id, donViIds);
        // X5: trường đã nộp hợp đồng → không nạp gì cả (cả transaction hủy).
        if (daNop.length > 0) await this.chanNapTruongDaNop(tx, daNop);
        const dongCu = {
          dot_trien_khai_id: dot.id,
          don_vi_id: { in: donViIds },
        };
        // Issue #62: đề nghị sửa/bớt trên dòng sắp bị thay → tự Từ chối; đề nghị thêm người vẫn chờ.
        const tc = await tuChoiDeNghiCuaDong(
          tx,
          dongCu,
          LY_DO_TU_CHOI_NAP_LAI,
          callerId,
        );
        await tx.danh_sach_tham_gia.deleteMany({ where: dongCu });
        await tx.danh_sach_tham_gia.createMany({
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
        });
        await this.sauQuanTriSua(tx, dot.id, donViIds, callerId);
        return tc;
      },
      { timeout: TIMEOUT_NAP_MS },
    );
    await this.ghiTuChoiTuDong(tuChoi);

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
    const [dong, nhom, hopDong, deNghiCho] = await Promise.all([
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
      this.prisma.hop_dong_boi_duong.findMany({
        where: { dot_trien_khai_id: dot.id },
        select: {
          don_vi_id: true,
          trang_thai_danh_sach: true,
          trang_thai_hop_dong: true,
        },
      }),
      // Issue #62: đề nghị chờ của cả đợt (đếm theo trường + đánh dấu dòng).
      this.prisma.de_nghi_sua_danh_sach.findMany({
        where: { dot_trien_khai_id: dot.id, trang_thai: 'cho' },
        select: { don_vi_id: true, dong_id: true },
      }),
    ]);
    const soChoTheoTruong = new Map<string, number>();
    for (const d of deNghiCho) {
      soChoTheoTruong.set(
        d.don_vi_id,
        (soChoTheoTruong.get(d.don_vi_id) ?? 0) + 1,
      );
    }
    const dongCoDeNghi = new Set(deNghiCho.map((d) => d.dong_id));
    const theoTruong = new Map(hopDong.map((h) => [h.don_vi_id, h]));
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
        trang_thai_danh_sach:
          theoTruong.get(n.don_vi_id)?.trang_thai_danh_sach ?? null,
        so_de_nghi_cho: soChoTheoTruong.get(n.don_vi_id) ?? 0,
        trang_thai_hop_dong:
          theoTruong.get(n.don_vi_id)?.trang_thai_hop_dong ?? null,
      }))
      .sort((a, b) => a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'));

    return {
      tong_hop,
      dong: dong.map((d) => ({
        ...toDongDanhSach(d),
        co_de_nghi_cho: dongCoDeNghi.has(d.id),
      })),
    };
  }

  // Issue #59 / ADR 0015 X3: Quản trị sửa/thêm/xóa từng dòng, bắt buộc lý do, ghi nhật ký.
  // Issue #61 / X1: mọi thay đổi của Quản trị đưa danh sách của trường bị ảnh hưởng về Chờ xác nhận
  // (issue #62: Báo sai lệch nếu trường còn dòng Không đồng ý / đề nghị chờ — trangThaiSauQuanTriSua).
  // Issue #62: sửa dòng đang có đề nghị chờ vẫn được — đề nghị giữ nguyên chờ Quản trị quyết định.
  // Issue #64 / X5: trường đã nộp hợp đồng → sửa/thêm/xóa 409 (kiểm dưới khóa FOR UPDATE của hop_dong).

  /** Sửa 1 dòng: chỉ đổi trường gửi lên; có đổi → mất ý kiến trường (X1). Không đổi gì → trả nguyên, không ghi nhật ký. */
  async suaDong(
    dongId: string,
    dto: SuaDongDanhSachDto,
    callerId: string,
  ): Promise<DongDanhSach> {
    const cu = await this.layDong(dongId);
    const { ly_do, ...sua } = dto;
    const truoc = giaTriGoc(cu);
    const sau = apDungSua(truoc, sua);
    const doi = khacBiet(truoc, sau);
    if (!doi) return toDongDanhSach(cu);
    if (sau.don_vi_id !== truoc.don_vi_id) {
      const dot = await this.layDot(cu.dot_trien_khai_id);
      await this.kiemTraTruong(dot.so_gddt_id, sau.don_vi_id);
    }

    // Chuyển trường → cả trường cũ (mất 1 dòng) lẫn trường mới đều tính lại trạng thái.
    const truongBiAnhHuong = [...new Set([truoc.don_vi_id, sau.don_vi_id])];
    const moi = await this.prisma.$transaction(async (tx) => {
      // Chuyển dòng sang trường khác → trường mới cũng phải có dòng hợp đồng (M5).
      await this.taoHopDongNeuChuaCo(tx, cu.dot_trien_khai_id, [sau.don_vi_id]);
      // X5: chuyển dòng giữa 2 trường → chặn nếu MỘT trong hai đã nộp hợp đồng.
      await khoaNhieuHopDongChuaNop(tx, cu.dot_trien_khai_id, truongBiAnhHuong);
      const dong = await tx.danh_sach_tham_gia.update({
        where: { id: cu.id },
        data: {
          ...sau,
          ngay_sinh: chuoiSangNgay(sau.ngay_sinh),
          updated_at: new Date(),
        },
      });
      await this.sauQuanTriSua(
        tx,
        cu.dot_trien_khai_id,
        truongBiAnhHuong,
        callerId,
      );
      return dong;
    });
    await this.nhatKy.ghi({
      hanh_dong: 'sua_dong_danh_sach',
      chi_tiet: {
        dot_trien_khai_id: moi.dot_trien_khai_id,
        dong_id: moi.id,
        don_vi_id: moi.don_vi_id,
        ly_do,
        ...doi,
      },
    });
    return toDongDanhSach(moi);
  }

  /** Thêm 1 dòng vào đợt HSG; giai đoạn mặc định Cả 2, suất suy từ giai đoạn nếu không gửi. */
  async themDong(
    dotId: string,
    dto: ThemDongDanhSachDto,
    callerId: string,
  ): Promise<DongDanhSach> {
    const dot = await this.layDotHsg(dotId);
    await this.kiemTraTruong(dot.so_gddt_id, dto.don_vi_id);
    const giai_doan = dto.giai_doan ?? 'ca_hai';
    const moi = await this.prisma.$transaction(async (tx) => {
      await this.taoHopDongNeuChuaCo(tx, dot.id, [dto.don_vi_id]);
      await khoaNhieuHopDongChuaNop(tx, dot.id, [dto.don_vi_id]);
      const dong = await tx.danh_sach_tham_gia.create({
        data: {
          dot_trien_khai_id: dot.id,
          don_vi_id: dto.don_vi_id,
          ho_ten: dto.ho_ten,
          ngay_sinh: chuoiSangNgay(dto.ngay_sinh ?? null),
          gioi_tinh: dto.gioi_tinh ?? null,
          ma_goc: dto.ma_goc ?? null,
          lop: dto.lop ?? null,
          giai_doan,
          ty_le_suat: dto.ty_le_suat ?? TY_LE_SUAT[giai_doan],
          ghi_chu: dto.ghi_chu ?? null,
          created_by: callerId,
        },
      });
      await this.sauQuanTriSua(tx, dot.id, [dto.don_vi_id], callerId);
      return dong;
    });
    await this.nhatKy.ghi({
      hanh_dong: 'them_dong_danh_sach',
      chi_tiet: {
        dot_trien_khai_id: dot.id,
        dong_id: moi.id,
        don_vi_id: moi.don_vi_id,
        ly_do: dto.ly_do,
        truoc: null,
        sau: banChup(moi),
      },
    });
    return toDongDanhSach(moi);
  }

  /**
   * Xóa cứng 1 dòng; nhật ký giữ bản chụp đầy đủ. Issue #62: đề nghị sửa/bớt đang chờ trên dòng bị tự
   * Từ chối ("Quản trị đã xóa dòng này") trước khi xóa.
   */
  async xoaDong(
    dongId: string,
    ly_do: string,
    callerId: string,
  ): Promise<void> {
    const cu = await this.layDong(dongId);
    const tuChoi = await this.prisma.$transaction(async (tx) => {
      await khoaNhieuHopDongChuaNop(tx, cu.dot_trien_khai_id, [cu.don_vi_id]);
      const tc = await tuChoiDeNghiCuaDong(
        tx,
        { id: cu.id },
        LY_DO_TU_CHOI_XOA_DONG,
        callerId,
      );
      const { count } = await tx.danh_sach_tham_gia.deleteMany({
        where: { id: cu.id },
      });
      if (count === 0) throw new NotFoundAppException(KHONG_THAY_DONG);
      await this.sauQuanTriSua(
        tx,
        cu.dot_trien_khai_id,
        [cu.don_vi_id],
        callerId,
      );
      return tc;
    });
    await this.ghiTuChoiTuDong(tuChoi);
    await this.nhatKy.ghi({
      hanh_dong: 'xoa_dong_danh_sach',
      chi_tiet: {
        dot_trien_khai_id: cu.dot_trien_khai_id,
        dong_id: cu.id,
        don_vi_id: cu.don_vi_id,
        ly_do,
        truoc: banChup(cu),
        sau: null,
      },
    });
  }

  /** Excel danh sách hiện tại của đợt (lọc 1 trường nếu có), theo tên trường rồi họ tên. */
  async xuatExcel(dotId: string, donViId?: string) {
    const dot = await this.layDot(dotId);
    const ds = await this.prisma.danh_sach_tham_gia.findMany({
      where: {
        dot_trien_khai_id: dot.id,
        ...(donViId ? { don_vi_id: donViId } : {}),
      },
      include: { don_vi: { select: { ten_don_vi: true, ma_don_vi: true } } },
    });
    ds.sort(
      (a, b) =>
        a.don_vi.ten_don_vi.localeCompare(b.don_vi.ten_don_vi, 'vi') ||
        a.ho_ten.localeCompare(b.ho_ten, 'vi') ||
        a.id.localeCompare(b.id),
    );
    const buffer = await taoFileXuatDanhSach(
      ds.map((d) => ({
        ...giaTriGoc(d),
        ma_truong: d.don_vi.ma_don_vi,
        ten_truong: d.don_vi.ten_don_vi,
      })),
    );
    // Có PII → ghi nhật ký (chỉ số dòng, không họ tên/ngày sinh), như các export học viên.
    await this.nhatKy.ghi({
      hanh_dong: 'xuat_danh_sach_tham_gia',
      chi_tiet: {
        dot_trien_khai_id: dot.id,
        don_vi_id: donViId ?? null,
        so_dong: ds.length,
      },
    });
    return { buffer, tenFile: tenFileXuatDanhSach(dot.ten, new Date()) };
  }

  /** X5: các trường của đợt đã nộp hợp đồng (tên theo vần). */
  private async truongDaNop(dotId: string) {
    const ds = await this.prisma.hop_dong_boi_duong.findMany({
      where: { dot_trien_khai_id: dotId, trang_thai_hop_dong: 'da_nop' },
      select: { don_vi: { select: { id: true, ten_don_vi: true } } },
    });
    return ds
      .map((h) => ({ don_vi_id: h.don_vi.id, ten_don_vi: h.don_vi.ten_don_vi }))
      .sort((a, b) => a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'));
  }

  /** X5: nạp có trường đã nộp hợp đồng → 409 kèm tên các trường đó; transaction hủy, không nạp gì. */
  private async chanNapTruongDaNop(tx: Tx, donViIds: string[]): Promise<never> {
    const ds = await tx.don_vi_cong_tac.findMany({
      where: { id: { in: donViIds } },
      select: { id: true, ten_don_vi: true },
    });
    const ten = ds
      .map((d) => d.ten_don_vi)
      .sort((a, b) => a.localeCompare(b, 'vi'));
    throw new ConflictAppException(
      `${DA_NOP_NAP_LAI}: ${ten.join(', ')}`,
      ds.map((d) => ({ field: d.id, message: d.ten_don_vi })),
    );
  }

  /**
   * ADR 0015 M5 (issue #60): mọi (đợt, trường) có ≥ 1 dòng danh sách đều có 1 dòng hop_dong_boi_duong.
   * Đã có thì giữ nguyên (không đặt lại trạng thái); danh sách rỗng đi cũng không xóa.
   */
  taoHopDongNeuChuaCo(tx: Tx, dotId: string, donViIds: string[]) {
    return tx.hop_dong_boi_duong.createMany({
      data: donViIds.map((don_vi_id) => ({
        dot_trien_khai_id: dotId,
        don_vi_id,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * ADR 0015 X1 (issue #61, #62): Quản trị sửa/thêm/xóa/nạp lại danh sách của trường → Chờ xác nhận, hoặc
   * Báo sai lệch nếu trường còn dòng Không đồng ý / đề nghị chờ (trangThaiSauQuanTriSua) + Quản trị là người
   * thao tác cuối. Dòng bị sửa đã mất ý kiến (apDungSua); dòng mới chưa có.
   */
  sauQuanTriSua(tx: Tx, dotId: string, donViIds: string[], callerId: string) {
    return datTrangThaiTheoSaiLech(
      tx,
      dotId,
      donViIds,
      callerId,
      trangThaiSauQuanTriSua,
    );
  }

  /** Nhật ký các đề nghị bị tự Từ chối (cùng hành động với Quản trị bấm Từ chối). */
  async ghiTuChoiTuDong(ds: DeNghiTuDongTuChoi[]) {
    if (ds.length === 0) return;
    await this.nhatKy.ghiNhieu(
      ds.map((chi_tiet) => ({
        hanh_dong: 'tu_choi_de_nghi_sua_danh_sach' as const,
        chi_tiet: { ...chi_tiet },
      })),
    );
  }

  /** Đơn vị phải là trường đang hoạt động trong cây Sở của đợt (T7). */
  private async kiemTraTruong(soId: string, donViId: string) {
    const phamVi = await this.truongCuaSo(soId);
    if (!phamVi.some((t) => t.id === donViId)) {
      const message =
        'Đơn vị không phải trường đang hoạt động trong phạm vi Sở của đợt';
      throw new ValidationException(message, [{ field: 'don_vi_id', message }]);
    }
  }

  private async layDong(id: string) {
    const dong = await this.prisma.danh_sach_tham_gia.findUnique({
      where: { id },
    });
    if (!dong) throw new NotFoundAppException(KHONG_THAY_DONG);
    return dong;
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
      select: { id: true, ten: true, chuong_trinh: true, so_gddt_id: true },
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
