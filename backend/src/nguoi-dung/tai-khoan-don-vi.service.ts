import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { paginate } from '../common/dto/pagination-query.dto';
import { layFrontendUrl } from '../common/utils/token-xac-thuc.util';
import {
  VAI_TRO_DON_VI,
  VaiTroDonVi,
  chuanHoaTenDangNhap,
  sinhMatKhauTam,
  vaiTroTheoLoaiDonVi,
} from './tai-khoan-don-vi.util';
import {
  LoiTaiKhoan,
  THONG_DIEP_TAI_KHOAN,
  chuanHoaEmail,
  kiemTraEmail,
  kiemTraTenDangNhap,
  mapLoiUniqueTaiKhoan,
  nemLoiTaiKhoan,
} from './tai-khoan.kiem-tra';
import {
  QueryDonViChuaCapDto,
  QueryTaiKhoanDonViDto,
  SuaTaiKhoanDonViDto,
  TaoTaiKhoanDonViDto,
} from './dto/tai-khoan-don-vi.dto';

const BCRYPT_SALT_ROUNDS = 10;

export const THONG_DIEP = {
  DON_VI_DA_CO_TK: 'Đơn vị đã có tài khoản',
  LOAI_KHONG_CAP: 'Loại đơn vị không được cấp tài khoản',
  KHONG_HOP_LE: 'Không hợp lệ',
  ...THONG_DIEP_TAI_KHOAN,
  CAN_EMAIL: 'Cần email để gửi link kích hoạt',
} as const;


const SELECT_VIEW = {
  id: true,
  ten_dang_nhap: true,
  ho_ten: true,
  email: true,
  vai_tro: true,
  trang_thai: true,
  dang_nhap_lan_cuoi: true,
  don_vi: {
    select: {
      id: true,
      ma_don_vi: true,
      ten_don_vi: true,
      loai_don_vi: true,
      trang_thai: true,
    },
  },
} satisfies Prisma.nguoi_dungSelect;

export type TaiKhoanDonViView = Prisma.nguoi_dungGetPayload<{
  select: typeof SELECT_VIEW;
}>;

type DuLieuTao = {
  donViId: string;
  tenDonVi: string;
  vaiTro: VaiTroDonVi;
  tenDangNhap: string;
  hoTen: string;
  email: string | null;
  cachCap: 'mat_khau_tam' | 'email';
};

// Tài khoản quản lý Sở/Phòng VHXH/Trường (ADR 0002, spec
// 2026-10-03-tai-khoan-don-vi-design.md). 1 tài khoản / đơn vị; cấp bằng
// mật khẩu tạm (mặc định) hoặc link kích hoạt qua email — 2 cách loại trừ.
@Injectable()
export class TaiKhoanDonViService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly thongBaoService: ThongBaoService,
  ) {}

  // Dùng chung cho POST /nguoi-dung/don-vi và import Excel (tai_khoan_don_vi).
  async chuanBiTao(
    dto: TaoTaiKhoanDonViDto,
  ): Promise<{ loi: LoiTaiKhoan[]; duLieu?: DuLieuTao }> {
    const loi: LoiTaiKhoan[] = [];
    const donVi = await this.prisma.don_vi_cong_tac.findUnique({
      where: { id: dto.don_vi_id },
    });
    let vaiTro: VaiTroDonVi | null = null;
    if (!donVi || donVi.trang_thai !== 'active') {
      loi.push({ field: 'don_vi_id', message: THONG_DIEP.KHONG_HOP_LE, status: 400 });
    } else {
      vaiTro = vaiTroTheoLoaiDonVi(donVi.loai_don_vi);
      if (!vaiTro) {
        loi.push({ field: 'don_vi_id', message: THONG_DIEP.LOAI_KHONG_CAP, status: 400 });
      } else if (
        await this.prisma.nguoi_dung.findFirst({
          where: { don_vi_id: donVi.id, vai_tro: { in: VAI_TRO_DON_VI } },
          select: { id: true },
        })
      ) {
        loi.push({ field: 'don_vi_id', message: THONG_DIEP.DON_VI_DA_CO_TK, status: 409 });
      }
    }

    const tenDangNhap = dto.ten_dang_nhap?.trim()
      ? chuanHoaTenDangNhap(dto.ten_dang_nhap)
      : donVi
        ? chuanHoaTenDangNhap(donVi.ma_don_vi)
        : '';
    if (donVi || dto.ten_dang_nhap?.trim()) {
      loi.push(...(await kiemTraTenDangNhap(this.prisma, tenDangNhap)));
    }

    const email = chuanHoaEmail(dto.email);
    if (email) loi.push(...(await kiemTraEmail(this.prisma, email)));

    const cachCap = dto.cach_cap ?? 'mat_khau_tam';
    if (cachCap === 'email' && !email) {
      loi.push({ field: 'email', message: THONG_DIEP.CAN_EMAIL, status: 400 });
    }

    if (loi.length > 0 || !donVi || !vaiTro) return { loi };
    return {
      loi,
      duLieu: {
        donViId: donVi.id,
        tenDonVi: donVi.ten_don_vi,
        vaiTro,
        tenDangNhap,
        hoTen: dto.ho_ten?.trim() || donVi.ten_don_vi,
        email,
        cachCap,
      },
    };
  }

  async taoTaiKhoan(
    dto: TaoTaiKhoanDonViDto,
    caller: AuthenticatedUser,
  ): Promise<{ tai_khoan: TaiKhoanDonViView; mat_khau_tam?: string }> {
    const { loi, duLieu } = await this.chuanBiTao(dto);
    if (!duLieu) nemLoiTaiKhoan(loi);
    const d = duLieu!;

    const matKhau = sinhMatKhauTam();
    const hash = await bcrypt.hash(matKhau, BCRYPT_SALT_ROUNDS);
    let token: string | undefined;
    let taiKhoan: TaiKhoanDonViView;
    try {
      taiKhoan = await this.prisma.$transaction(async (tx) => {
        const tk = await tx.nguoi_dung.create({
          data: {
            ho_ten: d.hoTen,
            ten_dang_nhap: d.tenDangNhap,
            email: d.email,
            vai_tro: d.vaiTro,
            don_vi_id: d.donViId,
            // cach_cap=email: hash của mật khẩu ngẫu nhiên không ai biết —
            // chỉ vào được qua link kích hoạt.
            mat_khau_hash: hash,
            phai_doi_mat_khau: true,
          },
          select: SELECT_VIEW,
        });
        if (d.cachCap === 'email') {
          token = await this.authService.taoTokenChoNguoiDung(
            tk.id,
            'kich_hoat_tai_khoan',
            tx,
          );
        }
        await tx.nhat_ky_dat_lai_mat_khau.create({
          data: { nguoi_dung_id: tk.id, thuc_hien_boi: caller.id },
        });
        return tk;
      });
    } catch (e) {
      throw mapLoiUniqueTaiKhoan(e, { field: 'don_vi_id', message: THONG_DIEP.DON_VI_DA_CO_TK });
    }

    if (token) {
      await this.guiEmail(taiKhoan, d.tenDonVi, token);
      return { tai_khoan: taiKhoan };
    }
    return { tai_khoan: taiKhoan, mat_khau_tam: matKhau };
  }

  async danhSach(query: QueryTaiKhoanDonViDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.nguoi_dungWhereInput = {
      vai_tro: query.vai_tro ? query.vai_tro : { in: VAI_TRO_DON_VI },
    };
    if (query.trang_thai) where.trang_thai = query.trang_thai;
    if (query.da_dang_nhap === true) where.dang_nhap_lan_cuoi = { not: null };
    if (query.da_dang_nhap === false) where.dang_nhap_lan_cuoi = null;
    const q = query.q?.trim();
    if (q) {
      const chua = { contains: q, mode: 'insensitive' as const };
      where.OR = [
        { ten_dang_nhap: chua },
        { email: chua },
        { ho_ten: chua },
        { don_vi: { ma_don_vi: chua } },
        { don_vi: { ten_don_vi: chua } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.nguoi_dung.findMany({
        where,
        select: SELECT_VIEW,
        orderBy: [{ vai_tro: 'asc' }, { ten_dang_nhap: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.nguoi_dung.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async donViChuaCap(query: QueryDonViChuaCapDto) {
    const where: Prisma.don_vi_cong_tacWhereInput = {
      trang_thai: 'active',
      loai_don_vi: query.loai_don_vi ? query.loai_don_vi : { in: VAI_TRO_DON_VI },
      nguoi_dung: { none: { vai_tro: { in: VAI_TRO_DON_VI } } },
    };
    const q = query.q?.trim();
    if (q) {
      const chua = { contains: q, mode: 'insensitive' as const };
      where.OR = [{ ma_don_vi: chua }, { ten_don_vi: chua }];
    }
    return this.prisma.don_vi_cong_tac.findMany({
      where,
      select: { id: true, ma_don_vi: true, ten_don_vi: true, loai_don_vi: true },
      orderBy: [{ loai_don_vi: 'asc' }, { ten_don_vi: 'asc' }],
      take: 50,
    });
  }

  async sua(id: string, dto: SuaTaiKhoanDonViDto): Promise<TaiKhoanDonViView> {
    const tk = await this.timTaiKhoan(id);
    const loi: LoiTaiKhoan[] = [];
    const data: Prisma.nguoi_dungUpdateInput = {};

    if (dto.ten_dang_nhap !== undefined) {
      const ten = chuanHoaTenDangNhap(dto.ten_dang_nhap);
      loi.push(...(await kiemTraTenDangNhap(this.prisma, ten, id)));
      data.ten_dang_nhap = ten;
    }
    if (dto.ho_ten !== undefined && dto.ho_ten.trim()) {
      data.ho_ten = dto.ho_ten.trim();
    }
    let doiEmail = false;
    if (dto.email !== undefined) {
      const email = chuanHoaEmail(dto.email);
      if (email) loi.push(...(await kiemTraEmail(this.prisma, email, id)));
      data.email = email;
      doiEmail = email !== tk.email;
    }
    if (dto.trang_thai) data.trang_thai = dto.trang_thai;
    if (loi.length > 0) nemLoiTaiKhoan(loi);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const kq = await tx.nguoi_dung.update({
          where: { id },
          data,
          select: SELECT_VIEW,
        });
        // Đổi/xóa email (vd. đổi người phụ trách) -> link kích hoạt/đặt lại
        // đã gửi tới email cũ không còn hợp lệ.
        if (doiEmail) await this.authService.voHieuTokenNguoiDung(id, tx);
        return kq;
      });
    } catch (e) {
      throw mapLoiUniqueTaiKhoan(e, { field: 'don_vi_id', message: THONG_DIEP.DON_VI_DA_CO_TK });
    }
  }

  async capMatKhauTam(id: string, caller: AuthenticatedUser) {
    const tk = await this.timTaiKhoan(id);
    const matKhau = sinhMatKhauTam();
    const hash = await bcrypt.hash(matKhau, BCRYPT_SALT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.nguoi_dung.update({
        where: { id },
        data: {
          mat_khau_hash: hash,
          phai_doi_mat_khau: true,
          khoa_den: null,
          so_lan_dang_nhap_sai: 0,
        },
      });
      await this.authService.voHieuTokenNguoiDung(id, tx);
      await tx.nhat_ky_dat_lai_mat_khau.create({
        data: { nguoi_dung_id: id, thuc_hien_boi: caller.id },
      });
    });
    return { ten_dang_nhap: tk.ten_dang_nhap, mat_khau_tam: matKhau };
  }

  async guiEmailKichHoat(id: string, caller: AuthenticatedUser) {
    const tk = await this.timTaiKhoan(id);
    if (!tk.email) {
      throw new ValidationException(THONG_DIEP.CAN_EMAIL, [
        { field: 'email', message: THONG_DIEP.CAN_EMAIL },
      ]);
    }
    // Mật khẩu tạm cũ mất hiệu lực — chỉ còn đường vào qua link mới.
    const hash = await bcrypt.hash(sinhMatKhauTam(), BCRYPT_SALT_ROUNDS);
    const token = await this.prisma.$transaction(async (tx) => {
      await tx.nguoi_dung.update({
        where: { id },
        data: { mat_khau_hash: hash, phai_doi_mat_khau: true },
      });
      const t = await this.authService.taoTokenChoNguoiDung(
        id,
        'kich_hoat_tai_khoan',
        tx,
      );
      await tx.nhat_ky_dat_lai_mat_khau.create({
        data: { nguoi_dung_id: id, thuc_hien_boi: caller.id },
      });
      return t;
    });
    await this.guiEmail(tk, tk.don_vi?.ten_don_vi ?? '', token);
    return { da_gui: true as const };
  }

  private async timTaiKhoan(id: string): Promise<TaiKhoanDonViView> {
    const tk = await this.prisma.nguoi_dung.findFirst({
      where: { id, vai_tro: { in: VAI_TRO_DON_VI } },
      select: SELECT_VIEW,
    });
    if (!tk) throw new NotFoundAppException('Không tìm thấy tài khoản đơn vị');
    return tk;
  }

  private async guiEmail(tk: TaiKhoanDonViView, tenDonVi: string, token: string) {
    await this.thongBaoService.guiKichHoatTaiKhoan({
      email: tk.email!,
      hoTen: tk.ho_ten,
      tenDonVi,
      tenDangNhap: tk.ten_dang_nhap,
      link: `${layFrontendUrl()}/dat-lai-mat-khau?token=${token}`,
    });
  }
}
