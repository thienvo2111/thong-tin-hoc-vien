import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { paginate } from '../common/dto/pagination-query.dto';
import { layFrontendUrl } from '../common/utils/token-xac-thuc.util';
import { chuanHoaTenDangNhap, sinhMatKhauTam } from './tai-khoan-don-vi.util';
import {
  LoiTaiKhoan,
  chuanHoaEmail,
  kiemTraEmail,
  kiemTraTenDangNhap,
  mapLoiUniqueTaiKhoan,
  nemLoiTaiKhoan,
} from './tai-khoan.kiem-tra';
import {
  QueryTaiKhoanHoTroDto,
  SuaTaiKhoanHoTroDto,
  TaoTaiKhoanHoTroDto,
} from './dto/tai-khoan-ho-tro.dto';

const BCRYPT_SALT_ROUNDS = 10;
const VAI_TRO = 'ho_tro_hoc_vien' as const;
const CAN_EMAIL = 'Người hỗ trợ học viên bắt buộc có email';

const SELECT_VIEW = {
  id: true,
  ten_dang_nhap: true,
  ho_ten: true,
  email: true,
  vai_tro: true,
  trang_thai: true,
  dang_nhap_lan_cuoi: true,
  phan_cong_ho_tro: {
    select: {
      cum: {
        select: {
          id: true,
          ten_cum: true,
          khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  },
} satisfies Prisma.nguoi_dungSelect;

type Row = Prisma.nguoi_dungGetPayload<{ select: typeof SELECT_VIEW }>;

export function toTaiKhoanHoTroView(row: Row) {
  const { phan_cong_ho_tro, ...rest } = row;
  return {
    ...rest,
    cum: phan_cong_ho_tro.map(({ cum }) => ({
      cum_id: cum.id,
      ten_cum: cum.ten_cum,
      khoa_id: cum.khoa.id,
      ma_khoa: cum.khoa.ma_khoa,
      ten_khoa: cum.khoa.ten_khoa,
    })),
  };
}

export type TaiKhoanHoTroView = ReturnType<typeof toTaiKhoanHoTroView>;

// Người hỗ trợ học viên (ADR 0003 H2–H4): cán bộ HCMUE, không gắn đơn vị,
// email bắt buộc; mặc định link kích hoạt, mật khẩu tạm dự phòng.
@Injectable()
export class TaiKhoanHoTroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly thongBaoService: ThongBaoService,
  ) {}

  async taoTaiKhoan(
    dto: TaoTaiKhoanHoTroDto,
    caller: AuthenticatedUser,
  ): Promise<{ tai_khoan: TaiKhoanHoTroView; mat_khau_tam?: string }> {
    const loi: LoiTaiKhoan[] = [];
    const hoTen = dto.ho_ten.trim();
    if (!hoTen)
      loi.push({
        field: 'ho_ten',
        message: 'Không được để trống',
        status: 400,
      });

    const email = chuanHoaEmail(dto.email);
    if (!email) loi.push({ field: 'email', message: CAN_EMAIL, status: 400 });
    else loi.push(...(await kiemTraEmail(this.prisma, email)));

    const tenDangNhap = chuanHoaTenDangNhap(
      dto.ten_dang_nhap?.trim() || (email ?? '').split('@')[0],
    );
    loi.push(...(await kiemTraTenDangNhap(this.prisma, tenDangNhap)));
    if (loi.length > 0) nemLoiTaiKhoan(loi);

    const cachCap = dto.cach_cap ?? 'email';
    const matKhau = sinhMatKhauTam();
    const hash = await bcrypt.hash(matKhau, BCRYPT_SALT_ROUNDS);
    let token: string | undefined;
    let row: Row;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        const tk = await tx.nguoi_dung.create({
          data: {
            ho_ten: hoTen,
            ten_dang_nhap: tenDangNhap,
            email,
            vai_tro: VAI_TRO,
            // cach_cap=email: mật khẩu ngẫu nhiên không ai biết — chỉ vào qua link.
            mat_khau_hash: hash,
            phai_doi_mat_khau: true,
          },
          select: SELECT_VIEW,
        });
        if (cachCap === 'email') {
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
      throw mapLoiUniqueTaiKhoan(e, { field: 'email', message: CAN_EMAIL });
    }

    const taiKhoan = toTaiKhoanHoTroView(row);
    if (token) {
      await this.guiEmail(taiKhoan, token);
      return { tai_khoan: taiKhoan };
    }
    return { tai_khoan: taiKhoan, mat_khau_tam: matKhau };
  }

  async danhSach(query: QueryTaiKhoanHoTroDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.nguoi_dungWhereInput = { vai_tro: VAI_TRO };
    if (query.trang_thai) where.trang_thai = query.trang_thai;
    const q = query.q?.trim();
    if (q) {
      const chua = { contains: q, mode: 'insensitive' as const };
      where.OR = [{ ten_dang_nhap: chua }, { email: chua }, { ho_ten: chua }];
    }
    const [rows, total] = await Promise.all([
      this.prisma.nguoi_dung.findMany({
        where,
        select: SELECT_VIEW,
        orderBy: { ho_ten: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.nguoi_dung.count({ where }),
    ]);
    return paginate(rows.map(toTaiKhoanHoTroView), total, page, pageSize);
  }

  async sua(id: string, dto: SuaTaiKhoanHoTroDto): Promise<TaiKhoanHoTroView> {
    const tk = await this.timTaiKhoan(id);
    const loi: LoiTaiKhoan[] = [];
    const data: Prisma.nguoi_dungUpdateInput = {};
    if (dto.ho_ten?.trim()) data.ho_ten = dto.ho_ten.trim();
    let doiEmail = false;
    if (dto.email !== undefined) {
      const email = chuanHoaEmail(dto.email);
      if (!email) loi.push({ field: 'email', message: CAN_EMAIL, status: 400 });
      else loi.push(...(await kiemTraEmail(this.prisma, email, id)));
      data.email = email;
      doiEmail = email !== tk.email;
    }
    if (dto.trang_thai) data.trang_thai = dto.trang_thai;
    if (loi.length > 0) nemLoiTaiKhoan(loi);

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const kq = await tx.nguoi_dung.update({
          where: { id },
          data,
          select: SELECT_VIEW,
        });
        // Link đã gửi tới email cũ không còn hợp lệ.
        if (doiEmail) await this.authService.voHieuTokenNguoiDung(id, tx);
        return kq;
      });
      return toTaiKhoanHoTroView(row);
    } catch (e) {
      throw mapLoiUniqueTaiKhoan(e, { field: 'email', message: CAN_EMAIL });
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
    await this.guiEmail(tk, token);
    return { da_gui: true as const };
  }

  private async timTaiKhoan(id: string): Promise<TaiKhoanHoTroView> {
    const row = await this.prisma.nguoi_dung.findFirst({
      where: { id, vai_tro: VAI_TRO },
      select: SELECT_VIEW,
    });
    if (!row)
      throw new NotFoundAppException('Không tìm thấy tài khoản người hỗ trợ');
    return toTaiKhoanHoTroView(row);
  }

  private async guiEmail(tk: TaiKhoanHoTroView, token: string) {
    await this.thongBaoService.guiKichHoatTaiKhoan({
      email: tk.email!,
      hoTen: tk.ho_ten,
      tenDonVi: null,
      tenDangNhap: tk.ten_dang_nhap,
      link: `${layFrontendUrl()}/dat-lai-mat-khau?token=${token}`,
    });
  }
}
