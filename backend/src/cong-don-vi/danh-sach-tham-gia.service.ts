import { Injectable } from '@nestjs/common';
import type {
  danh_sach_tham_gia,
  giai_doan_tham_gia,
  trang_thai_danh_sach_truong,
} from '@prisma/client';
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
import { thaoTacCuoi } from './truong-danh-sach.service';

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
  /** Issue #61 / X1: trạng thái danh sách của trường (null nếu chưa có dòng hợp đồng). */
  trang_thai_danh_sach: trang_thai_danh_sach_truong | null;
}

function giaTriGoc(d: danh_sach_tham_gia): DongDanhSachGoc {
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
function banChup(d: danh_sach_tham_gia) {
  return { ...giaTriGoc(d), hoc_vien_id: d.hoc_vien_id };
}

const KHONG_THAY_DONG = 'Không tìm thấy dòng danh sách';

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
    // Dòng hop_dong trước (tạo nếu thiếu + khóa bằng UPDATE) rồi mới đến dòng danh sách — cùng thứ tự khóa
    // với thao tác của trường (SELECT … FOR UPDATE hop_dong trước), tránh deadlock.
    await this.prisma.$transaction([
      this.taoHopDongNeuChuaCo(dot.id, donViIds),
      this.veChoXacNhan(dot.id, donViIds, callerId),
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
    const [dong, nhom, hopDong] = await Promise.all([
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
        select: { don_vi_id: true, trang_thai_danh_sach: true },
      }),
    ]);
    const trangThai = new Map(
      hopDong.map((h) => [h.don_vi_id, h.trang_thai_danh_sach]),
    );
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
        trang_thai_danh_sach: trangThai.get(n.don_vi_id) ?? null,
      }))
      .sort((a, b) => a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'));

    return {
      tong_hop,
      dong: dong.map(toDongDanhSach),
    };
  }

  // Issue #59 / ADR 0015 X3: Quản trị sửa/thêm/xóa từng dòng, bắt buộc lý do, ghi nhật ký.
  // Issue #61 / X1: mọi thay đổi của Quản trị đưa danh sách của trường bị ảnh hưởng về Chờ xác nhận.
  // TODO(ADR 0015 X5): chặn sửa/thêm/xóa khi trường đã nộp hợp đồng — chờ bảng hop_dong_boi_duong.

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

    // Chuyển dòng sang trường khác → trường mới cũng phải có dòng hợp đồng (M5).
    const [, , moi] = await this.prisma.$transaction([
      this.taoHopDongNeuChuaCo(cu.dot_trien_khai_id, [sau.don_vi_id]),
      // Chuyển trường → cả trường cũ (mất 1 dòng) lẫn trường mới đều về Chờ xác nhận.
      this.veChoXacNhan(
        cu.dot_trien_khai_id,
        [...new Set([truoc.don_vi_id, sau.don_vi_id])],
        callerId,
      ),
      this.prisma.danh_sach_tham_gia.update({
        where: { id: cu.id },
        data: {
          ...sau,
          ngay_sinh: chuoiSangNgay(sau.ngay_sinh),
          updated_at: new Date(),
        },
      }),
    ]);
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
    const [, , moi] = await this.prisma.$transaction([
      this.taoHopDongNeuChuaCo(dot.id, [dto.don_vi_id]),
      this.veChoXacNhan(dot.id, [dto.don_vi_id], callerId),
      this.prisma.danh_sach_tham_gia.create({
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
      }),
    ]);
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

  /** Xóa cứng 1 dòng; nhật ký giữ bản chụp đầy đủ. */
  async xoaDong(
    dongId: string,
    ly_do: string,
    callerId: string,
  ): Promise<void> {
    const cu = await this.layDong(dongId);
    await this.prisma.$transaction(async (tx) => {
      await tx.hop_dong_boi_duong.updateMany(
        this.lenhVeChoXacNhan(cu.dot_trien_khai_id, [cu.don_vi_id], callerId),
      );
      const { count } = await tx.danh_sach_tham_gia.deleteMany({
        where: { id: cu.id },
      });
      if (count === 0) throw new NotFoundAppException(KHONG_THAY_DONG);
    });
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

  /**
   * ADR 0015 M5 (issue #60): mọi (đợt, trường) có ≥ 1 dòng danh sách đều có 1 dòng hop_dong_boi_duong.
   * Đã có thì giữ nguyên (không đặt lại trạng thái); danh sách rỗng đi cũng không xóa.
   */
  private taoHopDongNeuChuaCo(dotId: string, donViIds: string[]) {
    return this.prisma.hop_dong_boi_duong.createMany({
      data: donViIds.map((don_vi_id) => ({
        dot_trien_khai_id: dotId,
        don_vi_id,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * ADR 0015 X1 (issue #61): Quản trị sửa/thêm/xóa/nạp lại danh sách của trường → về Chờ xác nhận (từ mọi
   * trạng thái) + Quản trị là người thao tác cuối. Dòng bị sửa đã mất ý kiến (apDungSua); dòng mới chưa có.
   */
  private veChoXacNhan(dotId: string, donViIds: string[], callerId: string) {
    return this.prisma.hop_dong_boi_duong.updateMany(
      this.lenhVeChoXacNhan(dotId, donViIds, callerId),
    );
  }

  private lenhVeChoXacNhan(
    dotId: string,
    donViIds: string[],
    callerId: string,
  ) {
    return {
      where: { dot_trien_khai_id: dotId, don_vi_id: { in: donViIds } },
      data: {
        trang_thai_danh_sach: trangThaiSauQuanTriSua(),
        ...thaoTacCuoi(callerId),
      },
    };
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
