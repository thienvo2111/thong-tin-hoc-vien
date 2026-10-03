import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Prisma, nguoi_dung, loai_token_xac_thuc } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService, DonViScope } from './scope/scope.service';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import {
  AccountLockedException,
  UnauthorizedAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  hashTokenXacThuc,
  layFrontendUrl,
  taoTokenXacThuc,
} from '../common/utils/token-xac-thuc.util';
import { DangNhapDto } from './dto/dang-nhap.dto';
import { DoiMatKhauDto } from './dto/doi-mat-khau.dto';
import { QuenMatKhauDto } from './dto/quen-mat-khau.dto';
import { DatLaiMatKhauDto } from './dto/dat-lai-mat-khau.dto';
import { XacMinhEmailDto } from './dto/xac-minh-email.dto';
import {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/jwt-payload.interface';
import {
  FieldMessage,
  matKhauMacDinhTuNgaySinh,
} from '../hoc-vien/hoc-vien-validation.util';
import {
  THOI_HAN_KICH_HOAT_MS,
  VAI_TRO_DON_VI,
} from '../nguoi-dung/tai-khoan-don-vi.util';

const BCRYPT_SALT_ROUNDS = 10;

// T1 (bảo mật đăng nhập, mo-rong-nls-an-giang.md): sai 5 lần liên tiếp ->
// khóa 15 phút.
const NGUONG_SO_LAN_SAI_KHOA = 5;
const THOI_GIAN_KHOA_MS = 15 * 60 * 1000;

// Xác minh email & quên/đặt lại mật khẩu (2026-09-30).
const THOI_HAN_DAT_LAI_MAT_KHAU_MS = 30 * 60 * 1000; // 30 phút
const THOI_GIAN_CHAN_SPAM_TOKEN_MS = 60 * 1000; // chặn tạo token lặp lại trong 60 giây
// Token sai/hết hạn/đã dùng dùng CHUNG 1 thông báo — không tiết lộ lý do cụ
// thể (rule tương tự #9/#34b của đăng nhập).
const THONG_DIEP_TOKEN_KHONG_HOP_LE = 'Liên kết không hợp lệ hoặc đã hết hạn';

export type SafeNguoiDung = Omit<nguoi_dung, 'mat_khau_hash'>;

export function sanitizeNguoiDung(user: nguoi_dung): SafeNguoiDung {
  const safe: Partial<nguoi_dung> = { ...user };
  delete safe.mat_khau_hash;
  return safe as SafeNguoiDung;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly scopeService: ScopeService,
    private readonly thongBaoService: ThongBaoService,
  ) {}

  // T4b (2026-09-29): mã định danh CSDL MOET và CCCD KHÔNG giả định trùng
  // nhau — chấp nhận tìm tài khoản bằng ten_dang_nhap GỐC hoặc bằng CCCD của
  // hồ sơ học viên liên kết (hoc_vien.so_dinh_danh_ca_nhan), kể cả khi tài
  // khoản được tạo bằng mã MOET rồi CCCD mới bổ sung sau qua PATCH
  // /hoc-vien/toi. Dùng chung cho dangNhap() và quenMatKhau() (2026-09-30) —
  // không lặp lại logic tìm tài khoản.
  //
  // ADR 0002: tài khoản đơn vị (so_gddt/phong_vhxh/truong) lưu tên đăng nhập
  // chữ thường và khớp KHÔNG phân biệt hoa/thường; học viên/quan_tri vẫn khớp
  // chính xác như cũ (không đổi hành vi đăng nhập của học viên).
  private timTaiKhoanTheoTenDangNhap(tenDangNhap: string) {
    return this.prisma.nguoi_dung.findFirst({
      where: {
        OR: [
          { ten_dang_nhap: tenDangNhap },
          {
            vai_tro: { in: VAI_TRO_DON_VI },
            ten_dang_nhap: { equals: tenDangNhap, mode: 'insensitive' },
          },
          { hoc_vien: { so_dinh_danh_ca_nhan: tenDangNhap } },
        ],
      },
      include: { hoc_vien: true },
    });
  }

  async dangNhap(dto: DangNhapDto) {
    const nguoiDung = await this.timTaiKhoanTheoTenDangNhap(dto.ten_dang_nhap);

    // Không tiết lộ "tài khoản không tồn tại" khác với "sai mật khẩu" —
    // cùng một thông báo chung để tránh dò tài khoản.
    if (!nguoiDung || nguoiDung.trang_thai !== 'active') {
      throw new UnauthorizedAppException();
    }

    const now = new Date();
    // T1: đang trong thời gian khóa -> 423, KHÔNG kiểm tra mật khẩu (đúng
    // hay sai cũng bị chặn như nhau — spec mo-rong-nls-an-giang.md mục T1).
    if (nguoiDung.khoa_den && nguoiDung.khoa_den > now) {
      throw new AccountLockedException(nguoiDung.khoa_den);
    }

    const khop = await bcrypt.compare(dto.mat_khau, nguoiDung.mat_khau_hash);
    if (!khop) {
      // Nếu từng có khoa_den nhưng đã hết hạn (đã "hết 15 phút"), coi như
      // bắt đầu đếm lại từ 0 trước khi cộng lần sai này — không cộng dồn lên
      // bộ đếm cũ đã hết hiệu lực.
      const soLanTruoc =
        nguoiDung.khoa_den && nguoiDung.khoa_den <= now
          ? 0
          : nguoiDung.so_lan_dang_nhap_sai;
      const soLanMoi = soLanTruoc + 1;
      await this.prisma.nguoi_dung.update({
        where: { id: nguoiDung.id },
        data: {
          so_lan_dang_nhap_sai: soLanMoi,
          khoa_den:
            soLanMoi >= NGUONG_SO_LAN_SAI_KHOA
              ? new Date(now.getTime() + THOI_GIAN_KHOA_MS)
              : null,
        },
      });
      throw new UnauthorizedAppException();
    }

    const updated = await this.prisma.nguoi_dung.update({
      where: { id: nguoiDung.id },
      data: {
        so_lan_dang_nhap_sai: 0,
        khoa_den: null,
        dang_nhap_lan_cuoi: now,
      },
    });

    const token = await this.signToken(updated);

    return {
      token,
      phai_doi_mat_khau: updated.phai_doi_mat_khau,
      nguoi_dung: sanitizeNguoiDung(updated),
    };
  }

  // POST /auth/dang-xuat (gap 1, 2026-09-28) — xem docs/api-contract.md mục 1
  // + docs/database-ddl.sql (token_thu_hoi). Ghi jti hiện tại vào bảng thu
  // hồi, het_han = hạn gốc của token (từ payload.exp, KHÔNG phải thời điểm
  // đăng xuất) để JwtAuthGuard từ chối đúng tới khi token hết hạn tự nhiên.
  // Idempotent: gọi lại với cùng token (đã bị thu hồi) không được ném lỗi.
  async dangXuat(user: AuthenticatedUser): Promise<{ da_dang_xuat: true }> {
    try {
      await this.prisma.token_thu_hoi.create({
        data: {
          jti: user.jti,
          nguoi_dung_id: user.id,
          het_han: new Date(user.exp * 1000),
        },
      });
    } catch (e) {
      if (!(
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      )) {
        throw e;
      }
    }
    return { da_dang_xuat: true };
  }

  async doiMatKhau(user: AuthenticatedUser, dto: DoiMatKhauDto) {
    const nguoiDung = await this.prisma.nguoi_dung.findUniqueOrThrow({
      where: { id: user.id },
    });

    const khop = await bcrypt.compare(dto.mat_khau_cu, nguoiDung.mat_khau_hash);
    if (!khop) {
      throw new ValidationException('Mật khẩu cũ không đúng', [
        { field: 'mat_khau_cu', message: 'Mật khẩu cũ không đúng' },
      ]);
    }

    const loiPhucTap = await this.kiemTraDoPhucTapMatKhauMoi(nguoiDung, dto);
    if (loiPhucTap.length > 0) {
      throw new ValidationException(
        'Mật khẩu mới không đạt yêu cầu',
        loiPhucTap,
      );
    }

    const matKhauHashMoi = await bcrypt.hash(
      dto.mat_khau_moi,
      BCRYPT_SALT_ROUNDS,
    );

    const updated = await this.prisma.nguoi_dung.update({
      where: { id: user.id },
      data: { mat_khau_hash: matKhauHashMoi, phai_doi_mat_khau: false },
    });

    return { nguoi_dung: sanitizeNguoiDung(updated) };
  }

  // T1: mật khẩu mới >= 8 ký tự, có cả chữ và số — dùng chung bởi
  // doiMatKhau() và datLaiMatKhau() (2026-09-30).
  private kiemTraDoDaiVaKyTuMatKhau(mk: string): FieldMessage[] {
    const loi: FieldMessage[] = [];
    if (mk.length < 8) {
      loi.push({ field: 'mat_khau_moi', message: 'Phải có ít nhất 8 ký tự' });
    }
    if (!/\d/.test(mk) || !/\p{L}/u.test(mk)) {
      loi.push({
        field: 'mat_khau_moi',
        message: 'Phải có cả chữ và số',
      });
    }
    return loi;
  }

  // T1: mật khẩu mới không được trùng chuỗi ngày sinh ddmmyyyy (nếu tài khoản
  // gắn hồ sơ học viên) — chính là mật khẩu mặc định lúc tạo tài khoản, xem
  // hoc-vien-validation.util.ts. Dùng chung bởi doiMatKhau() và
  // datLaiMatKhau() (2026-09-30).
  private async kiemTraKhacNgaySinh(
    nguoiDung: nguoi_dung,
    mk: string,
  ): Promise<FieldMessage[]> {
    if (!nguoiDung.hoc_vien_id) return [];
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id: nguoiDung.hoc_vien_id },
      select: { ngay_sinh: true, thang_sinh: true, nam_sinh: true },
    });
    if (!hocVien) return [];
    const ngaySinhStr = matKhauMacDinhTuNgaySinh(
      hocVien.ngay_sinh,
      hocVien.thang_sinh,
      hocVien.nam_sinh,
    );
    if (mk === ngaySinhStr) {
      return [
        {
          field: 'mat_khau_moi',
          message: 'Không được trùng ngày sinh (định dạng ddmmyyyy)',
        },
      ];
    }
    return [];
  }

  private async kiemTraDoPhucTapMatKhauMoi(
    nguoiDung: nguoi_dung,
    dto: DoiMatKhauDto,
  ): Promise<FieldMessage[]> {
    const loi = this.kiemTraDoDaiVaKyTuMatKhau(dto.mat_khau_moi);
    if (dto.mat_khau_moi === dto.mat_khau_cu) {
      loi.push({ field: 'mat_khau_moi', message: 'Phải khác mật khẩu cũ' });
    }
    loi.push(...(await this.kiemTraKhacNgaySinh(nguoiDung, dto.mat_khau_moi)));
    return loi;
  }

  // Cùng bộ quy tắc với kiemTraDoPhucTapMatKhauMoi() (doiMatKhau), chỉ khác ở
  // "khác mật khẩu cũ": datLaiMatKhau không có mật khẩu cũ dạng chữ rõ (quên
  // mật khẩu) nên so bằng bcrypt.compare() với hash hiện tại thay vì so chuỗi.
  private async kiemTraDoPhucTapMatKhauChoDatLai(
    nguoiDung: nguoi_dung,
    matKhauMoi: string,
  ): Promise<FieldMessage[]> {
    const loi = this.kiemTraDoDaiVaKyTuMatKhau(matKhauMoi);
    const trungMatKhauCu = await bcrypt.compare(
      matKhauMoi,
      nguoiDung.mat_khau_hash,
    );
    if (trungMatKhauCu) {
      loi.push({ field: 'mat_khau_moi', message: 'Phải khác mật khẩu cũ' });
    }
    loi.push(...(await this.kiemTraKhacNgaySinh(nguoiDung, matKhauMoi)));
    return loi;
  }

  // ---------------------------------------------------------------------
  // Quên mật khẩu / đặt lại mật khẩu / xác minh email (2026-09-30)
  // ---------------------------------------------------------------------

  // POST /auth/quen-mat-khau — LUÔN trả cùng 1 response (da_gui: true) bất kể
  // tài khoản có tồn tại, có phải học viên, có email, hay email đã xác minh
  // hay không — cùng nguyên tắc không tiết lộ enumeration với rule #9/#34b
  // (đăng nhập). Chỉ thực sự tạo token + gửi email khi tài khoản là học viên,
  // có email_lien_he VÀ email_lien_he đã xác minh (quyết định đã chốt).
  async quenMatKhau(dto: QuenMatKhauDto): Promise<{ da_gui: true }> {
    const nguoiDung = await this.timTaiKhoanTheoTenDangNhap(dto.ten_dang_nhap);

    if (
      nguoiDung &&
      nguoiDung.trang_thai === 'active' &&
      nguoiDung.vai_tro === 'hoc_vien' &&
      nguoiDung.hoc_vien?.email_lien_he &&
      nguoiDung.hoc_vien.email_da_xac_minh
    ) {
      await this.taoVaGuiTokenDatLaiMatKhau(
        nguoiDung.hoc_vien.id,
        nguoiDung.hoc_vien.ho_ten,
        nguoiDung.hoc_vien.email_lien_he,
      );
    } else if (
      nguoiDung &&
      nguoiDung.trang_thai === 'active' &&
      (VAI_TRO_DON_VI as string[]).includes(nguoiDung.vai_tro) &&
      nguoiDung.email
    ) {
      // ADR 0002: tài khoản đơn vị có email tự lấy lại mật khẩu.
      await this.taoVaGuiTokenDatLaiMatKhauNguoiDung(nguoiDung);
    }

    return { da_gui: true };
  }

  private async taoVaGuiTokenDatLaiMatKhau(
    hocVienId: string,
    hoTen: string,
    email: string,
  ): Promise<void> {
    const now = new Date();
    // Chặn spam đơn giản theo tài khoản: đã có token còn hiệu lực tạo trong
    // 60 giây gần nhất thì bỏ qua, không tạo/gửi lại — vẫn trả response
    // thành công như bình thường ở quenMatKhau() (không tiết lộ qua timing).
    const tokenGanDay = await this.prisma.token_xac_thuc.findFirst({
      where: {
        hoc_vien_id: hocVienId,
        loai: 'dat_lai_mat_khau',
        da_dung_luc: null,
        het_han_luc: { gt: now },
        tao_luc: { gt: new Date(now.getTime() - THOI_GIAN_CHAN_SPAM_TOKEN_MS) },
      },
    });
    if (tokenGanDay) return;

    const { token, tokenHash } = taoTokenXacThuc();
    await this.prisma.$transaction([
      // Vô hiệu các token dat_lai_mat_khau CHƯA DÙNG trước đó của cùng học
      // viên — chỉ token mới nhất còn dùng được.
      this.prisma.token_xac_thuc.updateMany({
        where: {
          hoc_vien_id: hocVienId,
          loai: 'dat_lai_mat_khau',
          da_dung_luc: null,
        },
        data: { da_dung_luc: now },
      }),
      this.prisma.token_xac_thuc.create({
        data: {
          hoc_vien_id: hocVienId,
          loai: 'dat_lai_mat_khau',
          token_hash: tokenHash,
          het_han_luc: new Date(now.getTime() + THOI_HAN_DAT_LAI_MAT_KHAU_MS),
        },
      }),
    ]);

    const link = `${layFrontendUrl()}/dat-lai-mat-khau?token=${token}`;
    await this.thongBaoService.guiDatLaiMatKhau(email, hoTen, link, hocVienId);
  }

  private async taoVaGuiTokenDatLaiMatKhauNguoiDung(
    nguoiDung: nguoi_dung,
  ): Promise<void> {
    const tokenGanDay = await this.prisma.token_xac_thuc.findFirst({
      where: {
        nguoi_dung_id: nguoiDung.id,
        loai: 'dat_lai_mat_khau',
        da_dung_luc: null,
        het_han_luc: { gt: new Date() },
        tao_luc: { gt: new Date(Date.now() - THOI_GIAN_CHAN_SPAM_TOKEN_MS) },
      },
    });
    if (tokenGanDay) return;
    const token = await this.taoTokenChoNguoiDung(
      nguoiDung.id,
      'dat_lai_mat_khau',
    );
    const link = `${layFrontendUrl()}/dat-lai-mat-khau?token=${token}`;
    await this.thongBaoService.guiDatLaiMatKhau(
      nguoiDung.email!,
      nguoiDung.ho_ten,
      link,
      null,
    );
  }

  // ADR 0002 — token gắn nguoi_dung_id (tài khoản đơn vị). Vô hiệu mọi token
  // CHƯA DÙNG cùng loại của người dùng, tạo token mới; trả token gốc (chỉ
  // hash được lưu). Dùng bởi TaiKhoanDonViService (kích hoạt) và quên mật khẩu.
  async taoTokenChoNguoiDung(
    nguoiDungId: string,
    loai: 'kich_hoat_tai_khoan' | 'dat_lai_mat_khau',
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db = tx ?? this.prisma;
    const now = new Date();
    const thoiHanMs =
      loai === 'kich_hoat_tai_khoan'
        ? THOI_HAN_KICH_HOAT_MS
        : THOI_HAN_DAT_LAI_MAT_KHAU_MS;
    const { token, tokenHash } = taoTokenXacThuc();
    await db.token_xac_thuc.updateMany({
      where: { nguoi_dung_id: nguoiDungId, loai, da_dung_luc: null },
      data: { da_dung_luc: now },
    });
    await db.token_xac_thuc.create({
      data: {
        nguoi_dung_id: nguoiDungId,
        loai,
        token_hash: tokenHash,
        het_han_luc: new Date(now.getTime() + thoiHanMs),
      },
    });
    return token;
  }

  // Vô hiệu MỌI token chưa dùng (mọi loại) của người dùng — khi cấp mật khẩu
  // tạm hoặc xóa email (ADR 0002: 2 cách cấp loại trừ nhau).
  async voHieuTokenNguoiDung(
    nguoiDungId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).token_xac_thuc.updateMany({
      where: { nguoi_dung_id: nguoiDungId, da_dung_luc: null },
      data: { da_dung_luc: new Date() },
    });
  }

  // POST /auth/dat-lai-mat-khau — token sai/hết hạn/đã dùng trả 1 thông báo
  // lỗi chung (không tiết lộ chi tiết, cùng nguyên tắc với xacMinhEmail()).
  // ADR 0002: nhận cả token kich_hoat_tai_khoan; token gắn hoc_vien_id (học
  // viên, như cũ) hoặc nguoi_dung_id (tài khoản đơn vị).
  async datLaiMatKhau(dto: DatLaiMatKhauDto): Promise<{ da_dat_lai: true }> {
    const tokenRow = await this.timVaXacThucToken(dto.token, [
      'dat_lai_mat_khau',
      'kich_hoat_tai_khoan',
    ]);
    const nguoiDung = tokenRow.nguoi_dung_id
      ? await this.prisma.nguoi_dung.findUnique({
          where: { id: tokenRow.nguoi_dung_id },
        })
      : tokenRow.hoc_vien_id
        ? await this.prisma.nguoi_dung.findUnique({
            where: { hoc_vien_id: tokenRow.hoc_vien_id },
          })
        : null;
    if (!nguoiDung) {
      // Không có tài khoản gắn với hồ sơ này — dữ liệu không nhất quán, coi
      // như token không hợp lệ thay vì lộ chi tiết nội bộ.
      throw new ValidationException(THONG_DIEP_TOKEN_KHONG_HOP_LE);
    }

    const loiPhucTap = await this.kiemTraDoPhucTapMatKhauChoDatLai(
      nguoiDung,
      dto.mat_khau_moi,
    );
    if (loiPhucTap.length > 0) {
      throw new ValidationException(
        'Mật khẩu mới không đạt yêu cầu',
        loiPhucTap,
      );
    }

    const matKhauHashMoi = await bcrypt.hash(
      dto.mat_khau_moi,
      BCRYPT_SALT_ROUNDS,
    );
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.nguoi_dung.update({
        where: { id: nguoiDung.id },
        data: { mat_khau_hash: matKhauHashMoi, phai_doi_mat_khau: false },
      }),
      // Vô hiệu MỌI token chưa dùng cùng loại của cùng chủ thể (kể cả token
      // vừa dùng — updateMany bao trọn, không cần update riêng rồi
      // updateMany phần còn lại).
      this.prisma.token_xac_thuc.updateMany({
        where: {
          ...(tokenRow.nguoi_dung_id
            ? { nguoi_dung_id: tokenRow.nguoi_dung_id }
            : { hoc_vien_id: tokenRow.hoc_vien_id }),
          loai: tokenRow.loai,
          da_dung_luc: null,
        },
        data: { da_dung_luc: now },
      }),
    ]);

    return { da_dat_lai: true };
  }

  // POST /auth/xac-minh-email — token sai/hết hạn/đã dùng trả 1 thông báo lỗi
  // chung, không tiết lộ chi tiết.
  async xacMinhEmail(dto: XacMinhEmailDto): Promise<{ da_xac_minh: true }> {
    const tokenRow = await this.timVaXacThucToken(dto.token, ['xac_minh_email']);
    await this.prisma.$transaction([
      this.prisma.hoc_vien.update({
        where: { id: tokenRow.hoc_vien_id! },
        data: { email_da_xac_minh: true },
      }),
      this.prisma.token_xac_thuc.update({
        where: { id: tokenRow.id },
        data: { da_dung_luc: new Date() },
      }),
    ]);
    return { da_xac_minh: true };
  }

  private async timVaXacThucToken(
    tokenGoc: string,
    cacLoai: loai_token_xac_thuc[],
  ) {
    const tokenHash = hashTokenXacThuc(tokenGoc);
    const row = await this.prisma.token_xac_thuc.findUnique({
      where: { token_hash: tokenHash },
    });
    const now = new Date();
    if (
      !row ||
      !cacLoai.includes(row.loai) ||
      row.da_dung_luc ||
      row.het_han_luc <= now
    ) {
      throw new ValidationException(THONG_DIEP_TOKEN_KHONG_HOP_LE);
    }
    return row;
  }

  async layThongTinHienTai(user: AuthenticatedUser) {
    const nguoiDung = await this.prisma.nguoi_dung.findUniqueOrThrow({
      where: { id: user.id },
    });
    const phamVi = await this.moTaPhamVi(user);
    return { nguoi_dung: sanitizeNguoiDung(nguoiDung), pham_vi: phamVi };
  }

  // Đáp ứng cột "phạm vi quyền suy ra" của GET /auth/toi trong
  // docs/api-contract.md. Hình dạng response cụ thể không được spec định
  // nghĩa chi tiết — improvise: trả loại phạm vi + danh sách don_vi_id (nếu
  // không phải ALL/rỗng) để FE/module khác tham khảo.
  private async moTaPhamVi(user: AuthenticatedUser) {
    if (user.vai_tro === 'hoc_vien') {
      return {
        loai: 'chi_ho_so_ca_nhan' as const,
        hoc_vien_id: user.hoc_vien_id,
      };
    }
    const scope: DonViScope =
      await this.scopeService.getAccessibleDonViIds(user);
    if (scope === 'ALL') {
      return { loai: 'toan_he_thong' as const };
    }
    return { loai: 'don_vi_va_con' as const, don_vi_ids: scope };
  }

  private async signToken(nguoiDung: nguoi_dung): Promise<string> {
    const payload: JwtPayload = {
      sub: nguoiDung.id,
      ten_dang_nhap: nguoiDung.ten_dang_nhap,
      vai_tro: nguoiDung.vai_tro,
      don_vi_id: nguoiDung.don_vi_id,
      hoc_vien_id: nguoiDung.hoc_vien_id,
      jti: randomUUID(),
    };
    return this.jwtService.signAsync(payload);
  }
}
