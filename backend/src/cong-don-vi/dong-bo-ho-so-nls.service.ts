import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { ngaySinhTuHocVien } from './chup-danh-sach-nls';
import {
  GiaTriCaNhanMoi,
  KetQuaDongBo,
  MSG_GIOI_TINH,
  maGioiTinh,
  suaHoSoTuDongBo,
  truongCaNhanDongBo,
} from './dong-bo-ho-so-nls';
import type { Tx } from './giao-dich-hop-dong';

/** GET …/danh-sach-tham-gia/:dongId/ho-so-hoc-vien — hồ sơ hiện tại để xem trước cũ → mới. */
export interface HoSoHocVienCuaDong {
  hoc_vien_id: string;
  ho_ten: string;
  /** 'YYYY-MM-DD'; null nếu ngày trong hồ sơ không có thật. */
  ngay_sinh: string | null;
  /** Mã hồ sơ (nam / nu / khac) như đang lưu. */
  gioi_tinh: string | null;
  don_vi: { id: string; ten: string };
}

export const TIEN_TO_LOI_HO_SO = 'Không cập nhật được hồ sơ học viên: ';
const FIELD_CO = 'dong_bo_ho_so_hoc_vien';
const KHONG_PHAI_NLS =
  'Dòng không gắn hồ sơ học viên NLS — không đồng bộ được hồ sơ';
const KHONG_CHAM_CA_NHAN =
  'Thao tác không đổi họ tên, ngày sinh, giới tính hay trường công tác — không có gì để đồng bộ về hồ sơ';
const CHI_DE_NGHI_SUA =
  'Chỉ đề nghị sửa thông tin mới đồng bộ được về hồ sơ học viên';

function loiCo(message: string): ValidationException {
  return new ValidationException(message, [{ field: FIELD_CO, message }]);
}

/** Lỗi từ đường sửa hồ sơ → cùng status/code, thông điệp có tiền tố. Lỗi không phải HTTP giữ nguyên. */
export function loiHoSo(e: unknown): unknown {
  if (!(e instanceof HttpException)) return e;
  const body = e.getResponse();
  const loi =
    typeof body === 'object' && body !== null && 'error' in body
      ? (body as { error: Record<string, unknown> }).error
      : { message: e.message };
  return new HttpException(
    {
      error: { ...loi, message: `${TIEN_TO_LOI_HO_SO}${String(loi.message)}` },
    },
    e.getStatus(),
  );
}

// Issue #69 / ADR 0015 Y2: đồng bộ ngược thông tin cá nhân của dòng NLS (hoc_vien_id) về hồ sơ học viên —
// chỉ khi Quản trị chọn trên đúng thao tác đó, ghi qua đường sửa hồ sơ của Quản trị (suaHoSoByAdmin: cùng
// kiểm tra, cùng lịch sử vai trò quan_tri, cùng quy tắc hủy xác nhận) TRONG transaction của danh sách.
@Injectable()
export class DongBoHoSoNlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hocVien: HocVienService,
  ) {}

  /** Chỉ đọc. Dòng không có / không gắn học viên / học viên đã mất → 404. */
  async xemHoSo(dongId: string): Promise<HoSoHocVienCuaDong> {
    const dong = await this.prisma.danh_sach_tham_gia.findUnique({
      where: { id: dongId },
      select: { hoc_vien_id: true },
    });
    if (!dong) throw new NotFoundAppException('Không tìm thấy dòng danh sách');
    if (!dong.hoc_vien_id) {
      throw new NotFoundAppException('Dòng không gắn hồ sơ học viên NLS');
    }
    const hv = await this.prisma.hoc_vien.findUnique({
      where: { id: dong.hoc_vien_id },
      select: {
        id: true,
        ho_ten: true,
        ngay_sinh: true,
        thang_sinh: true,
        nam_sinh: true,
        gioi_tinh: true,
        don_vi_cong_tac: { select: { id: true, ten_don_vi: true } },
      },
    });
    if (!hv) throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
    return {
      hoc_vien_id: hv.id,
      ho_ten: hv.ho_ten,
      ngay_sinh: ngaySinhTuHocVien(hv.ngay_sinh, hv.thang_sinh, hv.nam_sinh),
      gioi_tinh: hv.gioi_tinh,
      don_vi: { id: hv.don_vi_cong_tac.id, ten: hv.don_vi_cong_tac.ten_don_vi },
    };
  }

  /** Cờ bật trên đề nghị thêm/bớt người → 400. */
  chanLoaiDeNghi(loai: string): void {
    if (loai !== 'sua') throw loiCo(CHI_DE_NGHI_SUA);
  }

  /** Cờ bật: dòng HSG (không hoc_vien_id) hoặc thao tác không đổi trường cá nhân nào → 400. */
  chanKhongDongBoDuoc(
    hocVienId: string | null,
    giaTriMoi: GiaTriCaNhanMoi,
  ): void {
    if (!hocVienId) throw loiCo(KHONG_PHAI_NLS);
    if (Object.keys(giaTriMoi).length === 0) throw loiCo(KHONG_CHAM_CA_NHAN);
  }

  /**
   * Cờ bật: dòng phải gắn học viên và thao tác phải chạm ≥ 1 trường cá nhân (400 nếu không). So với hồ sơ HIỆN
   * TẠI; không khác gì → không ghi (so_truong 0). Hồ sơ từ chối → lỗi của hồ sơ (có tiền tố), transaction hủy.
   */
  async dongBo(
    tx: Tx,
    hocVienId: string | null,
    giaTriMoi: GiaTriCaNhanMoi,
    adminId: string,
    lyDo: string,
  ): Promise<KetQuaDongBo> {
    this.chanKhongDongBoDuoc(hocVienId, giaTriMoi);
    const id = hocVienId as string;
    const hv = await tx.hoc_vien.findUnique({
      where: { id },
      select: {
        ho_ten: true,
        ngay_sinh: true,
        thang_sinh: true,
        nam_sinh: true,
        gioi_tinh: true,
        don_vi_cong_tac_id: true,
      },
    });
    if (!hv) {
      throw loiHoSo(new NotFoundAppException('Không tìm thấy hồ sơ học viên'));
    }
    const ds = truongCaNhanDongBo(hv, giaTriMoi);
    const gioiTinh = ds.find((d) => d.truong === 'gioi_tinh');
    if (gioiTinh && maGioiTinh(gioiTinh.moi) === null) {
      throw loiHoSo(
        new ValidationException(MSG_GIOI_TINH, [
          { field: 'gioi_tinh', message: MSG_GIOI_TINH },
        ]),
      );
    }
    if (ds.length > 0) {
      try {
        await this.hocVien.suaHoSoByAdmin(
          id,
          suaHoSoTuDongBo(ds),
          { id: adminId, vai_tro: 'quan_tri' },
          { tx, lyDo },
        );
      } catch (e) {
        throw loiHoSo(e);
      }
    }
    const truong = ds.map((d) => d.truong);
    return { hoc_vien_id: id, truong, so_truong: truong.length };
  }
}
