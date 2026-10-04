import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { paginate } from '../common/dto/pagination-query.dto';
import {
  DoiTrangThaiTaiKhoanHocVienDto,
  QueryTaiKhoanHocVienDto,
} from './dto/tai-khoan-hoc-vien.dto';

export const PAGE_SIZE_TOI_DA = 100;

export const THONG_DIEP_HOC_VIEN = {
  KHONG_TIM_THAY: 'Không tìm thấy tài khoản',
  KHONG_PHAI_HOC_VIEN: 'Tài khoản không phải của học viên',
} as const;

// Select tường minh — KHÔNG BAO GIỜ trả mat_khau_hash.
export const SELECT_TAI_KHOAN_HOC_VIEN = {
  id: true,
  ten_dang_nhap: true,
  trang_thai: true,
  phai_doi_mat_khau: true,
  so_lan_dang_nhap_sai: true,
  khoa_den: true,
  dang_nhap_lan_cuoi: true,
  created_at: true,
  hoc_vien: {
    select: {
      id: true,
      ho_ten: true,
      so_dinh_danh_ca_nhan: true,
      ngay_sinh: true,
      thang_sinh: true,
      nam_sinh: true,
      so_dien_thoai_lien_he: true,
      email_lien_he: true,
      don_vi_cong_tac: { select: { id: true, ten_don_vi: true } },
    },
  },
} satisfies Prisma.nguoi_dungSelect;

export type TaiKhoanHocVienView = Prisma.nguoi_dungGetPayload<{
  select: typeof SELECT_TAI_KHOAN_HOC_VIEN;
}>;

// Quản lý tài khoản đăng nhập của học viên — chỉ quan_tri.
// Đặt lại mật khẩu theo ngày sinh vẫn ở POST /nguoi-dung/:id/dat-lai-mat-khau.
@Injectable()
export class TaiKhoanHocVienService {
  constructor(private readonly prisma: PrismaService) {}

  async danhSach(query: QueryTaiKhoanHocVienDto, now: Date = new Date()) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.page_size ?? 20, PAGE_SIZE_TOI_DA);
    const where: Prisma.nguoi_dungWhereInput = { vai_tro: 'hoc_vien' };
    if (query.trang_thai) where.trang_thai = query.trang_thai;
    if (query.tinh_trang === 'tam_khoa') where.khoa_den = { gt: now };
    if (query.tinh_trang === 'chua_dang_nhap') where.dang_nhap_lan_cuoi = null;
    if (query.tinh_trang === 'phai_doi_mat_khau') where.phai_doi_mat_khau = true;
    const q = query.q?.trim();
    if (q) {
      const chua = { contains: q, mode: 'insensitive' as const };
      where.OR = [
        { ten_dang_nhap: chua },
        { hoc_vien: { ho_ten: chua } },
        { hoc_vien: { so_dinh_danh_ca_nhan: { contains: q } } },
        { hoc_vien: { so_dien_thoai_lien_he: { contains: q } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.nguoi_dung.findMany({
        where,
        select: SELECT_TAI_KHOAN_HOC_VIEN,
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.nguoi_dung.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async doiTrangThai(
    id: string,
    dto: DoiTrangThaiTaiKhoanHocVienDto,
  ): Promise<TaiKhoanHocVienView> {
    await this.kiemTraHocVien(id);
    // Mở lại tài khoản -> xóa luôn khóa tạm/bộ đếm sai để vào được ngay.
    const data: Prisma.nguoi_dungUpdateInput =
      dto.trang_thai === 'active'
        ? { trang_thai: 'active', so_lan_dang_nhap_sai: 0, khoa_den: null }
        : { trang_thai: 'ngung' };
    return this.prisma.nguoi_dung.update({
      where: { id },
      data,
      select: SELECT_TAI_KHOAN_HOC_VIEN,
    });
  }

  async moKhoaTam(id: string): Promise<TaiKhoanHocVienView> {
    await this.kiemTraHocVien(id);
    return this.prisma.nguoi_dung.update({
      where: { id },
      data: { khoa_den: null, so_lan_dang_nhap_sai: 0 },
      select: SELECT_TAI_KHOAN_HOC_VIEN,
    });
  }

  private async kiemTraHocVien(id: string): Promise<void> {
    const tk = await this.prisma.nguoi_dung.findUnique({
      where: { id },
      select: { id: true, vai_tro: true },
    });
    if (!tk) throw new NotFoundAppException(THONG_DIEP_HOC_VIEN.KHONG_TIM_THAY);
    if (tk.vai_tro !== 'hoc_vien') {
      throw new ValidationException(THONG_DIEP_HOC_VIEN.KHONG_PHAI_HOC_VIEN, [
        { field: 'id', message: THONG_DIEP_HOC_VIEN.KHONG_PHAI_HOC_VIEN },
      ]);
    }
  }
}
