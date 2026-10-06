import { Injectable } from '@nestjs/common';
import { loai_lop_hoc, vai_tro_nhan_su_lop } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeNfcName } from '../common/utils/normalize-text.util';
import { RowBuildResult } from '../import/import.types';
import { chuanHoaEmail, chuanHoaSoDienThoai } from './lien-he.util';
import {
  chongGio,
  moTaBuoi,
  PhanCongGiangDayService,
} from './phan-cong-giang-day.service';

export interface GiangVienRowDto {
  /** Có = cập nhật giảng viên đã có (khớp theo email, rồi SĐT). */
  id?: string;
  ho_ten: string;
  so_dien_thoai: string;
  email?: string;
  don_vi_cong_tac?: string;
  ghi_chu?: string;
}

export interface PhanCongGiangDayRowDto {
  lich_hoc_id: string;
  giang_vien_id: string;
  vai_tro: vai_tro_nhan_su_lop;
  so_gio?: number;
}

const LOAI_LOP = ['truc_tiep', 'zoom', 'vle'];
const VAI_TRO = ['giang_vien', 'ho_tro'];

// T11 (issue #3): dựng/ghi dòng cho import giang_vien và phan_cong_giang_day
// (gọi từ ImportService). Dùng chung luật với nhập tay:
// lien-he.util (định dạng SĐT/email), PhanCongGiangDayService (trùng giờ).
@Injectable()
export class GiangVienImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly phanCong: PhanCongGiangDayService,
  ) {}

  // Khóa khớp: email (nếu có) rồi SĐT. Email trỏ GV A nhưng SĐT thuộc GV B
  // → dòng lỗi (không tự gộp). dupKeys chặn 2 dòng cùng email/SĐT trong file.
  async resolveGiangVienRow(
    raw: Record<string, string | undefined>,
    dupKeys?: Set<string>,
  ): Promise<RowBuildResult<GiangVienRowDto>> {
    const hoTen = raw.ho_ten?.trim();
    if (!hoTen) return { error: 'Thiếu cột "ho_ten"' };
    if (!raw.so_dien_thoai?.trim())
      return { error: 'Thiếu cột "so_dien_thoai"' };
    const sdt = chuanHoaSoDienThoai(raw.so_dien_thoai);
    if (!sdt) {
      return {
        error: `Số điện thoại "${raw.so_dien_thoai}" sai định dạng (10 số đầu 0, hoặc +84...)`,
      };
    }
    const email = chuanHoaEmail(raw.email);
    if (email === null) return { error: `Email "${raw.email}" sai định dạng` };

    if (dupKeys) {
      const khoa = [`gv|sdt|${sdt}`, ...(email ? [`gv|email|${email}`] : [])];
      if (khoa.some((k) => dupKeys.has(k))) {
        return { error: 'Trùng email/SĐT với dòng khác trong cùng file' };
      }
      khoa.forEach((k) => dupKeys.add(k));
    }

    const theoEmail = email
      ? await this.prisma.giang_vien.findUnique({ where: { email } })
      : null;
    const theoSdt = await this.prisma.giang_vien.findUnique({
      where: { so_dien_thoai: sdt },
    });
    if (theoEmail && theoSdt && theoEmail.id !== theoSdt.id) {
      return {
        error: `Email thuộc giảng viên "${theoEmail.ho_ten}" nhưng SĐT thuộc giảng viên "${theoSdt.ho_ten}"`,
      };
    }
    const hienCo = theoEmail ?? theoSdt;
    if (!theoEmail && theoSdt?.email && email && theoSdt.email !== email) {
      return {
        error: `SĐT đã thuộc giảng viên "${theoSdt.ho_ten}" với email khác (${theoSdt.email})`,
      };
    }
    return {
      dto: {
        id: hienCo?.id,
        ho_ten: normalizeNfcName(hoTen),
        so_dien_thoai: sdt,
        email: email ?? undefined,
        don_vi_cong_tac: raw.don_vi_cong_tac?.trim() || undefined,
        ghi_chu: raw.ghi_chu?.trim() || undefined,
      },
    };
  }

  async commitGiangVien(
    dto: GiangVienRowDto,
    importId: string,
    nguoiImportId: string,
  ): Promise<void> {
    const { id, ...data } = dto;
    if (id) {
      await this.prisma.giang_vien.update({ where: { id }, data });
    } else {
      await this.prisma.giang_vien.create({
        data: { ...data, nguon_import_id: importId, tao_boi: nguoiImportId },
      });
    }
  }

  async resolvePhanCongRow(
    raw: Record<string, string | undefined>,
    dupKeys?: Set<string>,
  ): Promise<RowBuildResult<PhanCongGiangDayRowDto>> {
    const maKhoa = raw.ma_khoa?.trim();
    if (!maKhoa) return { error: 'Thiếu cột "ma_khoa"' };
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { ma_khoa: maKhoa },
    });
    if (!khoa) return { error: `Khóa "${maKhoa}" không tồn tại` };

    const tenLop = raw.ten_lop?.trim();
    if (!tenLop) return { error: 'Thiếu cột "ten_lop"' };
    const loaiLop = raw.loai_lop?.trim();
    if (!loaiLop || !LOAI_LOP.includes(loaiLop)) {
      return { error: 'Cột "loai_lop" phải là "truc_tiep", "zoom" hoặc "vle"' };
    }
    const lop = await this.prisma.lop_hoc.findUnique({
      where: {
        khoa_id_loai_lop_ten_lop: {
          khoa_id: khoa.id,
          loai_lop: loaiLop as loai_lop_hoc,
          ten_lop: normalizeNfcName(tenLop),
        },
      },
    });
    if (!lop) return { error: `Lớp "${tenLop}" (${loaiLop}) không tồn tại` };

    const thuTu = Number(raw.giai_doan_thu_tu?.trim());
    const buoiSo = Number(raw.buoi_so?.trim());
    if (!Number.isInteger(thuTu) || !Number.isInteger(buoiSo) || buoiSo < 1) {
      return { error: 'Cột "giai_doan_thu_tu"/"buoi_so" phải là số nguyên' };
    }
    const lich = await this.prisma.lich_hoc_lop.findFirst({
      where: { lop_id: lop.id, buoi_so: buoiSo, giai_doan: { thu_tu: thuTu } },
    });
    if (!lich) {
      return {
        error: `Lớp "${tenLop}" chưa có buổi ${buoiSo} ở giai đoạn thứ tự ${thuTu}`,
      };
    }

    const email = chuanHoaEmail(raw.email);
    const sdt = raw.so_dien_thoai?.trim()
      ? chuanHoaSoDienThoai(raw.so_dien_thoai)
      : undefined;
    if (!email && !sdt) {
      return {
        error: 'Cần "email" hoặc "so_dien_thoai" hợp lệ của giảng viên',
      };
    }
    const gv = email
      ? await this.prisma.giang_vien.findUnique({ where: { email } })
      : await this.prisma.giang_vien.findUnique({
          where: { so_dien_thoai: sdt! },
        });
    if (!gv) {
      return {
        error: 'Không tìm thấy giảng viên (import danh mục giảng viên trước)',
      };
    }
    if (gv.trang_thai !== 'active') {
      return { error: `Giảng viên "${gv.ho_ten}" đã ngừng` };
    }

    const vaiTro = raw.vai_tro?.trim();
    if (!vaiTro || !VAI_TRO.includes(vaiTro)) {
      return { error: 'Cột "vai_tro" phải là "giang_vien" hoặc "ho_tro"' };
    }
    let soGio: number | undefined;
    if (raw.so_gio?.trim()) {
      soGio = Number(raw.so_gio.trim().replace(',', '.'));
      if (
        !(soGio > 0 && soGio < 1000) ||
        Math.round(soGio * 10) !== soGio * 10
      ) {
        return {
          error: 'Cột "so_gio" phải là số dương, tối đa 1 chữ số thập phân',
        };
      }
    }

    const daCo = await this.prisma.phan_cong_giang_day.findUnique({
      where: {
        lich_hoc_id_giang_vien_id: {
          lich_hoc_id: lich.id,
          giang_vien_id: gv.id,
        },
      },
    });
    if (
      daCo?.da_xac_nhan_gio &&
      soGio !== undefined &&
      Number(daCo.so_gio) !== soGio
    ) {
      return { error: 'Giờ dạy buổi này đã được xác nhận — không đổi số giờ' };
    }

    const trungDb = await this.phanCong.timBuoiTrungGio(gv.id, lich, lich.id);
    if (trungDb) {
      return {
        error: `Giảng viên "${gv.ho_ten}" đã dạy ${moTaBuoi(trungDb)} trùng giờ`,
      };
    }
    if (dupKeys) {
      const tienTo = `pcgd|${gv.id}|`;
      for (const k of dupKeys) {
        if (!k.startsWith(tienTo)) continue;
        const [, , lichId, bd, kt] = k.split('|');
        if (lichId === lich.id) {
          return {
            error: 'Trùng giảng viên + buổi với dòng khác trong cùng file',
          };
        }
        const khac = {
          thoi_gian_bat_dau: new Date(Number(bd)),
          thoi_gian_ket_thuc: new Date(Number(kt)),
        };
        if (chongGio(lich, khac)) {
          return {
            error: `Giảng viên "${gv.ho_ten}" có 2 buổi chồng giờ trong cùng file`,
          };
        }
      }
      dupKeys.add(
        `${tienTo}${lich.id}|${lich.thoi_gian_bat_dau.getTime()}|${lich.thoi_gian_ket_thuc.getTime()}`,
      );
    }

    return {
      dto: {
        lich_hoc_id: lich.id,
        giang_vien_id: gv.id,
        vai_tro: vaiTro as vai_tro_nhan_su_lop,
        so_gio: soGio,
      },
    };
  }

  async commitPhanCong(dto: PhanCongGiangDayRowDto): Promise<void> {
    await this.prisma.phan_cong_giang_day.upsert({
      where: {
        lich_hoc_id_giang_vien_id: {
          lich_hoc_id: dto.lich_hoc_id,
          giang_vien_id: dto.giang_vien_id,
        },
      },
      create: dto,
      update: { vai_tro: dto.vai_tro, so_gio: dto.so_gio },
    });
  }
}
