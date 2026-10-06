import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { CauHinhKhaoSatDto, KenhDanhGia } from './dto/cau-hinh-khao-sat.dto';

export const KHOA_CAU_HINH_KHAO_SAT = 'khao_sat_dau_vao';

export interface CauHinhKhaoSat {
  che_do_hoc_vien: CauHinhKhaoSatDto['che_do_hoc_vien'];
  danh_gia_dau_vao_trong_cong: boolean;
  hien_khao_sat: boolean;
  /** Thiếu ở cấu hình lưu trước 2026-10-02 — đọc qua layKenhDanhGia(). */
  kenh_danh_gia?: KenhDanhGia;
  /** Khối khảo sát đầu vào trên trang chủ học viên đã đăng nhập. Thiếu = hien_khao_sat || danh_gia_dau_vao_trong_cong. */
  khao_sat_dau_vao_mo?: boolean;
  /** Thiếu = chưa mở khảo sát đầu ra. */
  khao_sat_dau_ra_mo?: boolean;
  phieu: {
    ten: string;
    mo_ta: string;
    lien_ket: { nhan: string; url: string }[];
  }[];
}

/** Cấu hình đang áp dụng đến từ đâu: cấu hình chung hay cấu hình riêng của 1 khóa. */
export type PhamViCauHinh =
  | { loai: 'chung' }
  | {
      loai: 'khoa';
      khoa_id: string;
      ma_khoa: string;
      ten_khoa: string;
      tinh_id: string | null;
      ten_tinh: string | null;
    };

export interface KetQuaCauHinhKhaoSat {
  /** null = chưa lưu lần nào — frontend dùng giá trị mặc định trong mã nguồn. */
  cau_hinh: CauHinhKhaoSat | null;
  cap_nhat_luc: Date | null;
  pham_vi: PhamViCauHinh;
}

const INCLUDE_KHOA_TINH = {
  khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
  tinh: { select: { id: true, ten: true } },
} as const;

type RowKhoa = {
  khoa_id: string;
  tinh_id: string | null;
  gia_tri: unknown;
  cap_nhat_luc: Date;
  khoa: { id: string; ma_khoa: string; ten_khoa: string };
  tinh: { id: string; ten: string } | null;
};

function tuRowKhoa(row: RowKhoa): KetQuaCauHinhKhaoSat {
  return {
    cau_hinh: row.gia_tri as CauHinhKhaoSat,
    cap_nhat_luc: row.cap_nhat_luc,
    pham_vi: {
      loai: 'khoa',
      khoa_id: row.khoa.id,
      ma_khoa: row.khoa.ma_khoa,
      ten_khoa: row.khoa.ten_khoa,
      tinh_id: row.tinh?.id ?? null,
      ten_tinh: row.tinh?.ten ?? null,
    },
  };
}

// Cấu hình khảo sát: 1 cấu hình CHUNG (cau_hinh_he_thong) làm mặc định + cấu
// hình RIÊNG tùy chọn cho từng khóa (cau_hinh_khao_sat_khoa, 2026-10-02) khi
// tỉnh/khóa đó chọn phương án khác. Học viên đăng nhập -> khóa đã ghi danh;
// trang chủ công khai -> tỉnh người xem chọn.
@Injectable()
export class CauHinhKhaoSatService {
  constructor(private readonly prisma: PrismaService) {}

  async layCauHinh(): Promise<KetQuaCauHinhKhaoSat> {
    const row = await this.prisma.cau_hinh_he_thong.findUnique({
      where: { khoa: KHOA_CAU_HINH_KHAO_SAT },
    });
    return {
      cau_hinh: (row?.gia_tri as unknown as CauHinhKhaoSat) ?? null,
      cap_nhat_luc: row?.cap_nhat_luc ?? null,
      pham_vi: { loai: 'chung' },
    };
  }

  /** Cấu hình riêng của 1 khóa (quản trị); chưa có -> cau_hinh null, kèm thông tin khóa. */
  async layCauHinhKhoa(khoaId: string): Promise<KetQuaCauHinhKhaoSat> {
    const row = await this.prisma.cau_hinh_khao_sat_khoa.findUnique({
      where: { khoa_id: khoaId },
      include: INCLUDE_KHOA_TINH,
    });
    if (row) return tuRowKhoa(row);
    const khoa = await this.timKhoa(khoaId);
    return {
      cau_hinh: null,
      cap_nhat_luc: null,
      pham_vi: {
        loai: 'khoa',
        khoa_id: khoa.id,
        ma_khoa: khoa.ma_khoa,
        ten_khoa: khoa.ten_khoa,
        tinh_id: null,
        ten_tinh: null,
      },
    };
  }

  /** Trang chủ công khai: các tỉnh có khóa (đã duyệt) dùng cấu hình riêng. */
  async danhSachTinh(): Promise<{ tinh_id: string; ten_tinh: string }[]> {
    const rows = await this.prisma.cau_hinh_khao_sat_khoa.findMany({
      where: { tinh_id: { not: null }, khoa: { trang_thai: 'da_duyet' } },
      include: { tinh: { select: { id: true, ten: true } } },
    });
    return rows
      .filter((r) => r.tinh)
      .map((r) => ({ tinh_id: r.tinh!.id, ten_tinh: r.tinh!.ten }))
      .sort((a, b) => a.ten_tinh.localeCompare(b.ten_tinh, 'vi'));
  }

  /** Trang chủ công khai theo tỉnh; tỉnh không gắn khóa nào -> cấu hình chung. */
  async layTheoTinh(tinhId: string): Promise<KetQuaCauHinhKhaoSat> {
    const row = await this.prisma.cau_hinh_khao_sat_khoa.findFirst({
      where: { tinh_id: tinhId, khoa: { trang_thai: 'da_duyet' } },
      include: INCLUDE_KHOA_TINH,
    });
    return row ? tuRowKhoa(row) : this.layCauHinh();
  }

  /**
   * Cấu hình áp dụng cho 1 học viên: khóa ĐÃ DUYỆT mà học viên đã ghi danh và có
   * cấu hình riêng — nhiều khóa thì lấy khóa duyệt gần nhất; không có -> chung.
   */
  async layChoHocVien(hocVienId: string): Promise<KetQuaCauHinhKhaoSat> {
    const dangKy = await this.prisma.dang_ky_hoc.findFirst({
      where: {
        hoc_vien_id: hocVienId,
        khoa: { trang_thai: 'da_duyet', cau_hinh_khao_sat: { isNot: null } },
      },
      orderBy: [
        { khoa: { ngay_duyet: { sort: 'desc', nulls: 'last' } } },
        { ngay_dang_ky: 'desc' },
      ],
      select: { khoa_id: true },
    });
    if (!dangKy) return this.layCauHinh();
    const row = await this.prisma.cau_hinh_khao_sat_khoa.findUnique({
      where: { khoa_id: dangKy.khoa_id },
      include: INCLUDE_KHOA_TINH,
    });
    return row ? tuRowKhoa(row) : this.layCauHinh();
  }

  /** Kênh đánh giá đầu vào áp dụng cho học viên; chưa lưu / cấu hình cũ -> 'vle'. */
  async layKenhDanhGia(hocVienId: string): Promise<KenhDanhGia> {
    const { cau_hinh } = await this.layChoHocVien(hocVienId);
    return cau_hinh?.kenh_danh_gia ?? 'vle';
  }

  async khaoSatDauRaDangMo(hocVienId: string): Promise<boolean> {
    const { cau_hinh } = await this.layChoHocVien(hocVienId);
    return cau_hinh?.khao_sat_dau_ra_mo === true;
  }

  async luuCauHinh(
    dto: CauHinhKhaoSatDto,
    nguoiCapNhatId: string,
  ): Promise<KetQuaCauHinhKhaoSat> {
    const giaTri = this.chuanHoa(dto);
    const now = new Date();
    const row = await this.prisma.cau_hinh_he_thong.upsert({
      where: { khoa: KHOA_CAU_HINH_KHAO_SAT },
      create: {
        khoa: KHOA_CAU_HINH_KHAO_SAT,
        gia_tri: giaTri as object,
        cap_nhat_luc: now,
        cap_nhat_boi: nguoiCapNhatId,
      },
      update: {
        gia_tri: giaTri as object,
        cap_nhat_luc: now,
        cap_nhat_boi: nguoiCapNhatId,
      },
    });
    return {
      cau_hinh: giaTri,
      cap_nhat_luc: row.cap_nhat_luc,
      pham_vi: { loai: 'chung' },
    };
  }

  async luuCauHinhKhoa(
    khoaId: string,
    dto: CauHinhKhaoSatDto,
    tinhId: string | null,
    nguoiCapNhatId: string,
  ): Promise<KetQuaCauHinhKhaoSat> {
    await this.timKhoa(khoaId);
    const giaTri = this.chuanHoa(dto);

    if (tinhId) {
      const tinh = await this.prisma.dia_danh.findUnique({
        where: { id: tinhId },
      });
      if (!tinh || tinh.cap !== 'tinh_thanh') {
        throw new ValidationException('Tỉnh/thành không hợp lệ', [
          { field: 'tinh_id', message: 'Phải là địa danh cấp tỉnh/thành' },
        ]);
      }
      const trung = await this.prisma.cau_hinh_khao_sat_khoa.findUnique({
        where: { tinh_id: tinhId },
        include: { khoa: { select: { ma_khoa: true } } },
      });
      if (trung && trung.khoa_id !== khoaId) {
        throw new ConflictAppException(
          `Tỉnh/thành này đang gắn với khóa "${trung.khoa.ma_khoa}" — mỗi tỉnh chỉ gắn 1 khóa`,
        );
      }
    }

    const now = new Date();
    const data = {
      tinh_id: tinhId,
      gia_tri: giaTri as object,
      cap_nhat_luc: now,
      cap_nhat_boi: nguoiCapNhatId,
    };
    const row = await this.prisma.cau_hinh_khao_sat_khoa.upsert({
      where: { khoa_id: khoaId },
      create: { khoa_id: khoaId, ...data },
      update: data,
      include: INCLUDE_KHOA_TINH,
    });
    return tuRowKhoa(row);
  }

  /** Bỏ cấu hình riêng -> khóa quay về dùng cấu hình chung. */
  async xoaCauHinhKhoa(khoaId: string): Promise<void> {
    await this.prisma.cau_hinh_khao_sat_khoa.deleteMany({
      where: { khoa_id: khoaId },
    });
  }

  private async timKhoa(khoaId: string) {
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { id: khoaId },
      select: { id: true, ma_khoa: true, ten_khoa: true },
    });
    if (!khoa) throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');
    return khoa;
  }

  /** Kiểm tra quy tắc nghiệp vụ + trim chuỗi — dùng chung cho cấu hình chung và theo khóa. */
  private chuanHoa(dto: CauHinhKhaoSatDto): CauHinhKhaoSat {
    // Chế độ khảo sát mà ẩn khối khảo sát thì học viên không có chỗ nào để làm.
    if (dto.che_do_hoc_vien === 'khao_sat' && !dto.hien_khao_sat) {
      throw new ValidationException(
        'Chế độ "Khảo sát" cần bật hiển thị khối khảo sát trên trang chủ',
        [
          {
            field: 'hien_khao_sat',
            message: 'Phải bật khi chế độ là Khảo sát',
          },
        ],
      );
    }
    if (dto.hien_khao_sat && dto.phieu.length === 0) {
      throw new ValidationException('Cần ít nhất 1 phiếu khảo sát', [
        { field: 'phieu', message: 'Cần ít nhất 1 phiếu khi bật hiển thị' },
      ]);
    }
    return {
      che_do_hoc_vien: dto.che_do_hoc_vien,
      danh_gia_dau_vao_trong_cong: dto.danh_gia_dau_vao_trong_cong,
      hien_khao_sat: dto.hien_khao_sat,
      kenh_danh_gia: dto.kenh_danh_gia,
      khao_sat_dau_vao_mo:
        dto.khao_sat_dau_vao_mo ??
        (dto.hien_khao_sat || dto.danh_gia_dau_vao_trong_cong),
      khao_sat_dau_ra_mo: dto.khao_sat_dau_ra_mo ?? false,
      phieu: dto.phieu.map((p) => ({
        ten: p.ten.trim(),
        mo_ta: p.mo_ta.trim(),
        lien_ket: p.lien_ket.map((lk) => ({
          nhan: lk.nhan.trim(),
          url: lk.url.trim(),
        })),
      })),
    };
  }
}
