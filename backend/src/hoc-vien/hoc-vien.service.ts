import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  Prisma,
  cap_hoc,
  hoc_vien,
  hoc_vien_chuyen_mon,
  nguon_tao_ho_so,
  trinh_do_chuyen_mon,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { normalizeNfcName } from '../common/utils/normalize-text.util';
import { paginate } from '../common/dto/pagination-query.dto';
import {
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  FieldMessage,
  matKhauMacDinhTuNgaySinh,
  validateEmail,
  validateHoTen,
  validateNgayThangNamSinh,
  validateSoDienThoai,
  validateSoDinhDanh,
} from './hoc-vien-validation.util';
import { CreateHocVienDto } from './dto/create-hoc-vien.dto';
import { UpdateHocVienDto } from './dto/update-hoc-vien.dto';
import { QueryHocVienDto } from './dto/query-hoc-vien.dto';
import { DuyetHocVienDto } from './dto/duyet-hoc-vien.dto';
import { ChuyenMonDto } from './dto/chuyen-mon.dto';

const BCRYPT_SALT_ROUNDS = 10;

// Cấu trúc "hồ sơ sẽ có sau khi lưu" dùng chung cho validateHocVien — ở POST
// /hoc-vien đây chính là dto; ở PATCH /hoc-vien/toi đây là bản merge giữa hồ
// sơ hiện tại + field được sửa (xem capNhatHoSoCuaToi).
interface HocVienValidateInput {
  ho_ten?: string;
  so_dinh_danh_ca_nhan?: string | null;
  ngay_sinh?: number;
  thang_sinh?: number;
  nam_sinh?: number;
  noi_sinh_id?: string | null;
  phuong_xa_id?: string | null;
  don_vi_cong_tac_id?: string | null;
  so_dien_thoai_lien_he?: string | null;
  email_lien_he?: string | null;
  trinh_do_chuyen_mon?: trinh_do_chuyen_mon | null;
  trinh_do_chuyen_mon_khac?: string | null;
  cap_giang_day?: cap_hoc | null;
  mon_giang_day_id?: string | null;
  chuyen_mon?: string[];
}

type HocVienDayDu = hoc_vien & { chuyen_mon: hoc_vien_chuyen_mon[] };

// Dịch vụ Học viên — docs/api-contract.md mục 2 + docs/validation-checklist.md
// #1-36f. Đây là module có nhiều quy tắc validate nhất hệ thống — validateHocVien()
// là bộ quy tắc DÙNG CHUNG cho tự đăng ký (requireFull=true) và bổ sung/sửa
// (PATCH, requireFull=false); luồng import CSDL MOET dùng bộ quy tắc RIÊNG
// (checkValidMoetImportRow) vì cấu trúc dữ liệu dòng import khác hẳn (không có
// nơi sinh/phường xã/trình độ/email — xem "Luồng import nhân sự từ CSDL MOET").
@Injectable()
export class HocVienService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
  ) {}

  // ---------------------------------------------------------------------
  // Validate dùng chung (tu_dang_ky: create + PATCH + kiem-tra-truoc-xac-nhan)
  // ---------------------------------------------------------------------
  async validateHocVien(
    input: HocVienValidateInput,
    opts: { requireFull: boolean; excludeHocVienId?: string },
  ): Promise<{ loi: FieldMessage[]; canh_bao: FieldMessage[] }> {
    const loi: FieldMessage[] = [];
    const canhBao: FieldMessage[] = [];

    // Rule #1-5: họ và tên
    if (input.ho_ten !== undefined) {
      const r = validateHoTen(input.ho_ten);
      loi.push(...r.loi);
      canhBao.push(...r.canhBao);
    } else if (opts.requireFull) {
      loi.push({ field: 'ho_ten', message: 'Bắt buộc nhập' });
    }

    // Rule #6-7: ĐDCN
    if (input.so_dinh_danh_ca_nhan) {
      const dinhDangLoi = validateSoDinhDanh(input.so_dinh_danh_ca_nhan);
      loi.push(...dinhDangLoi);
      if (dinhDangLoi.length === 0) {
        const trung = await this.prisma.hoc_vien.findUnique({
          where: { so_dinh_danh_ca_nhan: input.so_dinh_danh_ca_nhan },
        });
        if (trung && trung.id !== opts.excludeHocVienId) {
          loi.push({
            field: 'so_dinh_danh_ca_nhan',
            message: 'Số định danh cá nhân đã được dùng bởi học viên khác',
          });
        }
      }
    } else if (opts.requireFull) {
      loi.push({ field: 'so_dinh_danh_ca_nhan', message: 'Bắt buộc nhập' });
    }

    // Rule #9-12: ngày/tháng/năm sinh
    if (
      input.ngay_sinh !== undefined &&
      input.thang_sinh !== undefined &&
      input.nam_sinh !== undefined
    ) {
      loi.push(
        ...validateNgayThangNamSinh(
          input.ngay_sinh,
          input.thang_sinh,
          input.nam_sinh,
        ),
      );
    } else if (opts.requireFull) {
      loi.push({
        field: 'ngay_sinh',
        message: 'Bắt buộc nhập đầy đủ ngày/tháng/năm sinh',
      });
    }

    // Rule #13-16: nơi sinh / phường-xã
    if (input.noi_sinh_id) {
      const diaDanh = await this.prisma.dia_danh.findUnique({
        where: { id: input.noi_sinh_id },
      });
      if (!diaDanh) {
        loi.push({ field: 'noi_sinh_id', message: 'Không tồn tại' });
      } else {
        if (diaDanh.cap !== 'tinh_thanh') {
          loi.push({
            field: 'noi_sinh_id',
            message: 'Phải là địa danh cấp tỉnh/thành',
          });
        }
        if (diaDanh.trang_thai !== 'active') {
          loi.push({
            field: 'noi_sinh_id',
            message: 'Địa danh đã ngừng sử dụng, không thể chọn mới',
          });
        }
      }
    } else if (opts.requireFull) {
      loi.push({ field: 'noi_sinh_id', message: 'Bắt buộc chọn' });
    }

    if (input.phuong_xa_id) {
      const diaDanh = await this.prisma.dia_danh.findUnique({
        where: { id: input.phuong_xa_id },
      });
      if (!diaDanh) {
        loi.push({ field: 'phuong_xa_id', message: 'Không tồn tại' });
      } else {
        if (diaDanh.cap !== 'phuong_xa_dac_khu') {
          loi.push({
            field: 'phuong_xa_id',
            message: 'Phải là địa danh cấp phường/xã',
          });
        }
        if (diaDanh.trang_thai !== 'active') {
          loi.push({
            field: 'phuong_xa_id',
            message: 'Địa danh đã ngừng sử dụng, không thể chọn mới',
          });
        }
        if (input.noi_sinh_id && diaDanh.parent_id !== input.noi_sinh_id) {
          loi.push({
            field: 'phuong_xa_id',
            message: 'Phải thuộc tỉnh/thành đã chọn ở noi_sinh_id',
          });
        }
      }
    } else if (opts.requireFull) {
      loi.push({ field: 'phuong_xa_id', message: 'Bắt buộc chọn' });
    }

    // Rule #17-18: đơn vị công tác — luôn bắt buộc (NOT NULL cả 2 luồng)
    if (input.don_vi_cong_tac_id) {
      const donVi = await this.prisma.don_vi_cong_tac.findUnique({
        where: { id: input.don_vi_cong_tac_id },
      });
      if (!donVi) {
        loi.push({ field: 'don_vi_cong_tac_id', message: 'Không tồn tại' });
      } else {
        if (donVi.trang_thai !== 'active') {
          loi.push({
            field: 'don_vi_cong_tac_id',
            message: 'Đơn vị đã ngừng hoạt động',
          });
        }
        if (donVi.loai_don_vi !== 'truong') {
          loi.push({
            field: 'don_vi_cong_tac_id',
            message: 'Chỉ được chọn đơn vị loại Trường',
          });
        }
      }
    } else {
      loi.push({ field: 'don_vi_cong_tac_id', message: 'Bắt buộc chọn' });
    }

    // Rule #19-20: số điện thoại — luôn bắt buộc
    if (input.so_dien_thoai_lien_he) {
      loi.push(...validateSoDienThoai(input.so_dien_thoai_lien_he));
    } else {
      loi.push({
        field: 'so_dien_thoai_lien_he',
        message: 'Bắt buộc nhập',
      });
    }

    // Rule #19, #21: email
    if (input.email_lien_he) {
      loi.push(...validateEmail(input.email_lien_he));
    } else if (opts.requireFull) {
      loi.push({ field: 'email_lien_he', message: 'Bắt buộc nhập' });
    }

    // Rule #22-23: trình độ chuyên môn
    if (!input.trinh_do_chuyen_mon && opts.requireFull) {
      loi.push({ field: 'trinh_do_chuyen_mon', message: 'Bắt buộc chọn' });
    }
    if (
      input.trinh_do_chuyen_mon === 'khac' &&
      !input.trinh_do_chuyen_mon_khac
    ) {
      loi.push({
        field: 'trinh_do_chuyen_mon_khac',
        message: 'Bắt buộc nhập khi trình độ chuyên môn = khác',
      });
    }

    // Rule #25-26: cấp giảng dạy / môn giảng dạy (tùy chọn, phụ thuộc lẫn nhau)
    if (input.mon_giang_day_id) {
      if (!input.cap_giang_day) {
        loi.push({
          field: 'mon_giang_day_id',
          message: 'Chỉ chọn được khi đã có cấp giảng dạy',
        });
      } else {
        const mon = await this.prisma.mon_hoc.findUnique({
          where: { id: input.mon_giang_day_id },
        });
        if (!mon) {
          loi.push({ field: 'mon_giang_day_id', message: 'Không tồn tại' });
        } else {
          if (mon.trang_thai !== 'active') {
            loi.push({
              field: 'mon_giang_day_id',
              message: 'Môn học đã ngừng sử dụng',
            });
          }
          if (mon.cap_hoc !== input.cap_giang_day) {
            loi.push({
              field: 'mon_giang_day_id',
              message: 'Môn học không thuộc đúng cấp giảng dạy đã chọn',
            });
          }
        }
      }
    }

    // Rule #24: chuyên môn — chỉ kiểm tra khi requireFull (PATCH không mang
    // theo field này, quản lý riêng qua themChuyenMon/xoaChuyenMon)
    if (opts.requireFull) {
      const list = (input.chuyen_mon ?? [])
        .map((c) => c.trim())
        .filter(Boolean);
      if (list.length === 0) {
        loi.push({
          field: 'chuyen_mon',
          message: 'Bắt buộc có ít nhất 1 chuyên môn',
        });
      }
    }

    return { loi, canh_bao: canhBao };
  }

  private isEditable(hocVien: {
    trang_thai: hoc_vien['trang_thai'];
    nguon_tao: nguon_tao_ho_so;
  }): boolean {
    return (
      hocVien.trang_thai === 'nhap' ||
      hocVien.trang_thai === 'tu_choi' ||
      hocVien.nguon_tao === 'import_moet'
    );
  }

  private toResponse(hocVien: HocVienDayDu) {
    const { chuyen_mon, ...rest } = hocVien;
    return { ...rest, chuyen_mon: chuyen_mon.map((c) => c.chuyen_mon) };
  }

  private async getHocVienCuaToi(
    caller: AuthenticatedUser,
  ): Promise<HocVienDayDu> {
    if (!caller.hoc_vien_id) {
      throw new ForbiddenAppException(
        'Tài khoản hiện tại không gắn với hồ sơ học viên nào',
      );
    }
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id: caller.hoc_vien_id },
      include: { chuyen_mon: true },
    });
    if (!hocVien) {
      throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
    }
    return hocVien;
  }

  // ---------------------------------------------------------------------
  // POST /hoc-vien — Luồng đăng ký (docs/api-contract.md mục 2)
  // ---------------------------------------------------------------------
  async dangKy(dto: CreateHocVienDto) {
    // Kiểm tra trùng ĐDCN riêng, TRƯỚC bộ validateHocVien dùng chung — theo
    // đúng quy ước lỗi chung (docs/api-contract.md mục "Quy ước chung > Lỗi":
    // CONFLICT 409 dùng cho "trùng ĐDCN..."), trong khi validateHocVien() gộp
    // mọi quy tắc (kể cả kiểm tra trùng) vào 1 danh sách loi dùng chung cho
    // dry-run (kiem-tra-truoc-xac-nhan trả 200 kèm loi[], không phải mã lỗi
    // HTTP riêng cho từng field).
    const trungSdd = await this.prisma.hoc_vien.findUnique({
      where: { so_dinh_danh_ca_nhan: dto.so_dinh_danh_ca_nhan },
    });
    if (trungSdd) {
      throw new ConflictAppException(
        'Số định danh cá nhân đã được dùng bởi học viên khác',
        [{ field: 'so_dinh_danh_ca_nhan', message: 'Đã tồn tại' }],
      );
    }

    const { loi } = await this.validateHocVien(dto, { requireFull: true });
    if (loi.length > 0) {
      throw new ValidationException('Dữ liệu đăng ký không hợp lệ', loi);
    }

    const hoTenChuan = normalizeNfcName(dto.ho_ten);
    const matKhau = matKhauMacDinhTuNgaySinh(
      dto.ngay_sinh,
      dto.thang_sinh,
      dto.nam_sinh,
    );
    const matKhauHash = await bcrypt.hash(matKhau, BCRYPT_SALT_ROUNDS);
    const chuyenMonChuan = Array.from(
      new Set(dto.chuyen_mon.map((c) => normalizeNfcName(c)).filter(Boolean)),
    );

    try {
      const ketQua = await this.prisma.$transaction(async (tx) => {
        // Thứ tự tạo bảng ĐẢO NGƯỢC so với văn bản "Luồng đăng ký" của
        // api-contract.md (vốn mô tả tạo nguoi_dung trước): DB CHECK
        // chk_nguoi_dung_scope bắt buộc nguoi_dung.hoc_vien_id NOT NULL NGAY
        // khi vai_tro='hoc_vien', nên không thể tạo nguoi_dung trước với
        // hoc_vien_id=NULL như mô tả gốc — phải tạo hoc_vien trước (created_by
        // để trống), tạo nguoi_dung với hoc_vien_id trỏ sẵn, rồi backfill
        // hoc_vien.created_by. Cùng 3 bảng ghi, cùng 1 transaction, chỉ khác
        // thứ tự — kết quả cuối giống hệt spec. Flagged trong self-review.
        const hocVien = await tx.hoc_vien.create({
          data: {
            nguon_tao: 'tu_dang_ky',
            ho_ten: hoTenChuan,
            so_dinh_danh_ca_nhan: dto.so_dinh_danh_ca_nhan,
            ngay_sinh: dto.ngay_sinh,
            thang_sinh: dto.thang_sinh,
            nam_sinh: dto.nam_sinh,
            gioi_tinh: dto.gioi_tinh,
            chuc_vu: dto.chuc_vu,
            noi_sinh_id: dto.noi_sinh_id,
            phuong_xa_id: dto.phuong_xa_id,
            don_vi_cong_tac_id: dto.don_vi_cong_tac_id,
            so_dien_thoai_lien_he: dto.so_dien_thoai_lien_he,
            email_lien_he: dto.email_lien_he,
            trinh_do_chuyen_mon: dto.trinh_do_chuyen_mon,
            trinh_do_chuyen_mon_khac: dto.trinh_do_chuyen_mon_khac,
            cap_giang_day: dto.cap_giang_day,
            mon_giang_day_id: dto.mon_giang_day_id,
            ghi_chu: dto.ghi_chu,
            chuyen_mon: {
              create: chuyenMonChuan.map((c) => ({ chuyen_mon: c })),
            },
          },
        });
        const nguoiDung = await tx.nguoi_dung.create({
          data: {
            ho_ten: hoTenChuan,
            email: dto.email_lien_he,
            ten_dang_nhap: dto.so_dinh_danh_ca_nhan,
            vai_tro: 'hoc_vien',
            don_vi_id: null,
            hoc_vien_id: hocVien.id,
            mat_khau_hash: matKhauHash,
            phai_doi_mat_khau: true,
          },
        });
        await tx.hoc_vien.update({
          where: { id: hocVien.id },
          data: { created_by: nguoiDung.id },
        });
        return {
          hoc_vien_id: hocVien.id,
          ten_dang_nhap: nguoiDung.ten_dang_nhap,
        };
      });

      return {
        ...ketQua,
        luu_y:
          'Mật khẩu mặc định là ngày sinh (định dạng ddmmyyyy) — bắt buộc đổi khi đăng nhập lần đầu',
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictAppException(
          'Số định danh cá nhân hoặc tên đăng nhập đã tồn tại',
        );
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------------
  // GET/PATCH /hoc-vien/toi + chuyên môn + xác nhận
  // ---------------------------------------------------------------------
  async layHoSoCuaToi(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);
    return this.toResponse(hocVien);
  }

  async capNhatHoSoCuaToi(caller: AuthenticatedUser, dto: UpdateHocVienDto) {
    const existing = await this.getHocVienCuaToi(caller);
    if (!this.isEditable(existing)) {
      throw new ConflictAppException(
        'Hồ sơ đang chờ duyệt hoặc đã duyệt, không thể sửa',
      );
    }

    const merged: HocVienValidateInput = {
      ho_ten: dto.ho_ten ?? existing.ho_ten,
      so_dinh_danh_ca_nhan:
        dto.so_dinh_danh_ca_nhan ?? existing.so_dinh_danh_ca_nhan,
      ngay_sinh: dto.ngay_sinh ?? existing.ngay_sinh,
      thang_sinh: dto.thang_sinh ?? existing.thang_sinh,
      nam_sinh: dto.nam_sinh ?? existing.nam_sinh,
      noi_sinh_id: dto.noi_sinh_id ?? existing.noi_sinh_id,
      phuong_xa_id: dto.phuong_xa_id ?? existing.phuong_xa_id,
      don_vi_cong_tac_id: dto.don_vi_cong_tac_id ?? existing.don_vi_cong_tac_id,
      so_dien_thoai_lien_he:
        dto.so_dien_thoai_lien_he ?? existing.so_dien_thoai_lien_he,
      email_lien_he: dto.email_lien_he ?? existing.email_lien_he,
      trinh_do_chuyen_mon:
        dto.trinh_do_chuyen_mon ?? existing.trinh_do_chuyen_mon,
      trinh_do_chuyen_mon_khac:
        dto.trinh_do_chuyen_mon_khac ?? existing.trinh_do_chuyen_mon_khac,
      cap_giang_day: dto.cap_giang_day ?? existing.cap_giang_day,
      mon_giang_day_id: dto.mon_giang_day_id ?? existing.mon_giang_day_id,
    };

    const { loi } = await this.validateHocVien(merged, {
      requireFull: false,
      excludeHocVienId: existing.id,
    });
    if (loi.length > 0) {
      throw new ValidationException('Dữ liệu cập nhật không hợp lệ', loi);
    }

    try {
      const updated = await this.prisma.hoc_vien.update({
        where: { id: existing.id },
        data: {
          ho_ten: merged.ho_ten ? normalizeNfcName(merged.ho_ten) : undefined,
          so_dinh_danh_ca_nhan: merged.so_dinh_danh_ca_nhan,
          ngay_sinh: merged.ngay_sinh,
          thang_sinh: merged.thang_sinh,
          nam_sinh: merged.nam_sinh,
          gioi_tinh: dto.gioi_tinh,
          chuc_vu: dto.chuc_vu,
          noi_sinh_id: merged.noi_sinh_id,
          phuong_xa_id: merged.phuong_xa_id,
          don_vi_cong_tac_id: merged.don_vi_cong_tac_id ?? undefined,
          so_dien_thoai_lien_he: merged.so_dien_thoai_lien_he ?? undefined,
          email_lien_he: merged.email_lien_he,
          trinh_do_chuyen_mon: merged.trinh_do_chuyen_mon,
          trinh_do_chuyen_mon_khac: merged.trinh_do_chuyen_mon_khac,
          cap_giang_day: merged.cap_giang_day,
          mon_giang_day_id: merged.mon_giang_day_id,
          ghi_chu: dto.ghi_chu,
          // Rule #27: hồ sơ bị tu_choi thì sửa xong tự mở lại nhap (coi như
          // resubmit chờ xác nhận lại).
          trang_thai: existing.trang_thai === 'tu_choi' ? 'nhap' : undefined,
        },
        include: { chuyen_mon: true },
      });
      return this.toResponse(updated);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictAppException('Số định danh cá nhân đã tồn tại');
      }
      throw e;
    }
  }

  async themChuyenMon(caller: AuthenticatedUser, dto: ChuyenMonDto) {
    const hocVien = await this.getHocVienCuaToi(caller);
    if (!this.isEditable(hocVien)) {
      throw new ConflictAppException(
        'Hồ sơ đang chờ duyệt hoặc đã duyệt, không thể sửa chuyên môn',
      );
    }
    const chuyenMon = normalizeNfcName(dto.chuyen_mon);
    try {
      await this.prisma.hoc_vien_chuyen_mon.create({
        data: { hoc_vien_id: hocVien.id, chuyen_mon: chuyenMon },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictAppException('Chuyên môn này đã có trong hồ sơ');
      }
      throw e;
    }
    return this.layHoSoCuaToi(caller);
  }

  async xoaChuyenMon(caller: AuthenticatedUser, dto: ChuyenMonDto) {
    const hocVien = await this.getHocVienCuaToi(caller);
    if (!this.isEditable(hocVien)) {
      throw new ConflictAppException(
        'Hồ sơ đang chờ duyệt hoặc đã duyệt, không thể sửa chuyên môn',
      );
    }
    await this.prisma.hoc_vien_chuyen_mon.deleteMany({
      where: {
        hoc_vien_id: hocVien.id,
        chuyen_mon: normalizeNfcName(dto.chuyen_mon),
      },
    });
    return this.layHoSoCuaToi(caller);
  }

  async kiemTraTruocXacNhan(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);
    return this.validateHocVien(
      { ...hocVien, chuyen_mon: hocVien.chuyen_mon.map((c) => c.chuyen_mon) },
      { requireFull: true, excludeHocVienId: hocVien.id },
    );
  }

  // POST /hoc-vien/toi/xac-nhan — chuyển nhap/tu_choi -> cho_duyet (stub gửi
  // email); nếu đã da_duyet (điển hình: import_moet sau khi tự bổ sung) thì
  // chỉ gửi lại email, KHÔNG đổi trang_thai (api-contract.md mục 2: "chỉ dùng
  // nó nếu muốn gửi lại email xác nhận sau khi bổ sung thông tin").
  async xacNhan(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);

    if (hocVien.trang_thai === 'nhap' || hocVien.trang_thai === 'tu_choi') {
      const { loi } = await this.validateHocVien(
        { ...hocVien, chuyen_mon: hocVien.chuyen_mon.map((c) => c.chuyen_mon) },
        { requireFull: true, excludeHocVienId: hocVien.id },
      );
      if (loi.length > 0) {
        throw new ValidationException(
          'Hồ sơ chưa đầy đủ/hợp lệ, không thể xác nhận',
          loi,
        );
      }
      const updated = await this.prisma.hoc_vien.update({
        where: { id: hocVien.id },
        data: { trang_thai: 'cho_duyet', email_ban_sao_da_gui_at: new Date() },
        include: { chuyen_mon: true },
      });
      this.guiEmailXacNhanStub(hocVien.id);
      return this.toResponse(updated);
    }

    if (hocVien.trang_thai === 'da_duyet') {
      const updated = await this.prisma.hoc_vien.update({
        where: { id: hocVien.id },
        data: { email_ban_sao_da_gui_at: new Date() },
        include: { chuyen_mon: true },
      });
      this.guiEmailXacNhanStub(hocVien.id);
      return this.toResponse(updated);
    }

    throw new ConflictAppException(
      `Hồ sơ đang ở trạng thái "${hocVien.trang_thai}", không thể xác nhận`,
    );
  }

  // TODO: Dịch vụ Thông báo (docs/api-contract.md mục 8, event
  // hoc_vien.xac_nhan) chưa được triển khai — log rõ ràng thay vì gửi email
  // thật, để không bỏ sót việc chuyển trạng thái/ghi email_ban_sao_da_gui_at.
  private guiEmailXacNhanStub(hocVienId: string) {
    console.log(
      `[thong-bao:TODO] Gửi email bản sao dữ liệu cho hoc_vien_id=${hocVienId} (event hoc_vien.xac_nhan)`,
    );
  }

  // TODO: tương tự — event hoc_vien.duyet.
  private guiEmailDuyetStub(hocVienId: string, ketQua: string) {
    console.log(
      `[thong-bao:TODO] Gửi email kết quả duyệt (${ketQua}) cho hoc_vien_id=${hocVienId} (event hoc_vien.duyet)`,
    );
  }

  // ---------------------------------------------------------------------
  // GET /hoc-vien, GET /hoc-vien/{id}, GET /hoc-vien/kiem-tra-trung
  // ---------------------------------------------------------------------
  async findAll(query: QueryHocVienDto, caller: AuthenticatedUser) {
    const scope = await this.scopeService.getAccessibleDonViIds(caller);
    const where: Prisma.hoc_vienWhereInput = {};

    if (scope !== 'ALL') {
      if (
        query.don_vi_cong_tac_id &&
        !scope.includes(query.don_vi_cong_tac_id)
      ) {
        throw new ForbiddenAppException(
          'Đơn vị công tác nằm ngoài phạm vi quyền',
        );
      }
      where.don_vi_cong_tac_id = query.don_vi_cong_tac_id
        ? query.don_vi_cong_tac_id
        : { in: scope };
    } else if (query.don_vi_cong_tac_id) {
      where.don_vi_cong_tac_id = query.don_vi_cong_tac_id;
    }

    if (query.trang_thai) where.trang_thai = query.trang_thai;
    if (query.cap_giang_day) where.cap_giang_day = query.cap_giang_day;
    if (query.nguon_tao) where.nguon_tao = query.nguon_tao;
    if (query.q) {
      where.OR = [
        { ho_ten: { contains: query.q, mode: 'insensitive' } },
        { so_dinh_danh_ca_nhan: { contains: query.q } },
        { ma_dinh_danh_moet: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const [data, total] = await Promise.all([
      this.prisma.hoc_vien.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.hoc_vien.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(id: string, caller: AuthenticatedUser) {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id },
      include: { chuyen_mon: true },
    });
    if (!hocVien)
      throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
    const coQuyen = await this.scopeService.canAccessDonVi(
      caller,
      hocVien.don_vi_cong_tac_id,
    );
    if (!coQuyen) {
      throw new ForbiddenAppException(
        'Hồ sơ này nằm ngoài phạm vi quyền của tài khoản hiện tại',
      );
    }
    return this.toResponse(hocVien);
  }

  async kiemTraTrung(soDinhDanh: string) {
    if (!/^[0-9]{12}$/.test(soDinhDanh)) {
      throw new ValidationException(
        'Số định danh cá nhân phải gồm đúng 12 chữ số',
        [{ field: 'so_dinh_danh_ca_nhan', message: 'Phải gồm đúng 12 chữ số' }],
      );
    }
    const existing = await this.prisma.hoc_vien.findUnique({
      where: { so_dinh_danh_ca_nhan: soDinhDanh },
    });
    return { ton_tai: existing !== null };
  }

  // ---------------------------------------------------------------------
  // POST /hoc-vien/{id}/duyet — routing theo cap_giang_day (rule #25b, #29-31)
  // ---------------------------------------------------------------------
  async duyet(id: string, dto: DuyetHocVienDto, caller: AuthenticatedUser) {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id },
      include: { don_vi_cong_tac: true },
    });
    if (!hocVien)
      throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');

    if (hocVien.nguon_tao !== 'tu_dang_ky') {
      throw new ConflictAppException(
        'Hồ sơ nhập từ CSDL MOET đã ở trạng thái duyệt sẵn, không qua bước duyệt này',
      );
    }
    if (hocVien.trang_thai !== 'cho_duyet') {
      throw new ConflictAppException(
        `Hồ sơ đang ở trạng thái "${hocVien.trang_thai}", không thể duyệt`,
      );
    }

    const donViDuyet = await this.resolveDonViDuyet(
      hocVien.cap_giang_day,
      hocVien.don_vi_cong_tac.dia_ban_id,
    );
    const coQuyen = await this.scopeService.canAccessDonVi(
      caller,
      donViDuyet.id,
    );
    if (!coQuyen) {
      throw new ForbiddenAppException(
        'Không có quyền duyệt hồ sơ — nằm ngoài phạm vi đơn vị duyệt phụ trách',
      );
    }

    const ghiChuMoi =
      dto.ket_qua === 'tu_choi' && dto.ly_do
        ? `${hocVien.ghi_chu ? hocVien.ghi_chu + '\n' : ''}[Từ chối] ${dto.ly_do}`
        : hocVien.ghi_chu;

    const updated = await this.prisma.hoc_vien.update({
      where: { id },
      data: {
        trang_thai: dto.ket_qua,
        nguoi_duyet_id: caller.id,
        cap_duyet_thuc_te: caller.vai_tro,
        ngay_duyet: new Date(),
        ghi_chu: ghiChuMoi,
      },
      include: { chuyen_mon: true },
    });
    this.guiEmailDuyetStub(id, dto.ket_qua);
    return this.toResponse(updated);
  }

  // Rule #25b: THPT/NULL -> Sở GD&ĐT quản lý tỉnh chứa dia_ban_id của đơn vị
  // công tác; MN/TH/THCS -> Phòng VHXH quản lý đúng xã đó. Định tuyến theo
  // cây địa lý (dia_danh), KHÔNG theo don_vi_cha_id (chỉ dùng cho phân quyền
  // escalation qua ScopeService, xem docs/database-ddl.sql comment).
  private async resolveDonViDuyet(
    capGiangDay: cap_hoc | null,
    xaId: string,
  ): Promise<{ id: string }> {
    if (capGiangDay === null || capGiangDay === 'thpt') {
      const xa = await this.prisma.dia_danh.findUnique({ where: { id: xaId } });
      if (!xa || !xa.parent_id) {
        throw new NotFoundAppException(
          'Không xác định được tỉnh/thành quản lý địa bàn của đơn vị công tác',
        );
      }
      const so = await this.prisma.don_vi_cong_tac.findFirst({
        where: { loai_don_vi: 'so_gddt', dia_ban: { parent_id: xa.parent_id } },
      });
      if (!so) {
        throw new NotFoundAppException(
          'Không tìm thấy Sở GD&ĐT quản lý tỉnh/thành tương ứng trong danh mục',
        );
      }
      return so;
    }

    const phong = await this.prisma.don_vi_cong_tac.findFirst({
      where: { loai_don_vi: 'phong_vhxh', dia_ban_id: xaId },
    });
    if (!phong) {
      throw new NotFoundAppException(
        'Không tìm thấy Phòng Văn hóa - Xã hội quản lý địa bàn tương ứng trong danh mục',
      );
    }
    return phong;
  }

  // ---------------------------------------------------------------------
  // Import CSDL MOET (gọi từ ImportService — validation-checklist.md #36b-36f)
  // ---------------------------------------------------------------------
  async checkValidMoetImportRow(input: {
    ma_dinh_danh_moet: string;
    ho_ten: string;
    ngay_sinh: number;
    thang_sinh: number;
    nam_sinh: number;
    so_dien_thoai_lien_he: string;
    chuyen_mon: string[];
    don_vi_cong_tac_id: string;
  }): Promise<void> {
    const loi: FieldMessage[] = [];

    if (!input.ma_dinh_danh_moet) {
      loi.push({ field: 'ma_dinh_danh_moet', message: 'Bắt buộc nhập' });
    } else {
      const trung = await this.prisma.hoc_vien.findUnique({
        where: { ma_dinh_danh_moet: input.ma_dinh_danh_moet },
      });
      if (trung) {
        loi.push({
          field: 'ma_dinh_danh_moet',
          message: 'Mã định danh CSDL MOET đã tồn tại (rule #36f)',
        });
      }
    }

    loi.push(...validateHoTen(input.ho_ten).loi);
    loi.push(
      ...validateNgayThangNamSinh(
        input.ngay_sinh,
        input.thang_sinh,
        input.nam_sinh,
      ),
    );
    loi.push(...validateSoDienThoai(input.so_dien_thoai_lien_he));

    const donVi = await this.prisma.don_vi_cong_tac.findUnique({
      where: { id: input.don_vi_cong_tac_id },
    });
    if (!donVi) {
      loi.push({
        field: 'don_vi_cong_tac_id',
        message: 'Đơn vị công tác không tồn tại',
      });
    } else if (
      donVi.trang_thai !== 'active' ||
      donVi.loai_don_vi !== 'truong'
    ) {
      loi.push({
        field: 'don_vi_cong_tac_id',
        message: 'Đơn vị công tác phải đang hoạt động và thuộc loại Trường',
      });
    }

    if (input.chuyen_mon.length === 0) {
      loi.push({
        field: 'chuyen_mon',
        message:
          'Cột "Chuyên môn" phải có ít nhất 1 giá trị (phân tách bằng ";")',
      });
    }

    if (loi.length > 0) {
      throw new ValidationException('Dòng dữ liệu không hợp lệ', loi);
    }
  }

  async createFromMoetImport(
    input: {
      ma_dinh_danh_moet: string;
      ho_ten: string;
      ngay_sinh: number;
      thang_sinh: number;
      nam_sinh: number;
      chuc_vu?: string;
      don_vi_cong_tac_id: string;
      so_dien_thoai_lien_he: string;
      ghi_chu?: string;
      chuyen_mon: string[];
    },
    nguoiImportId: string,
  ): Promise<hoc_vien> {
    await this.checkValidMoetImportRow(input);

    const hoTenChuan = normalizeNfcName(input.ho_ten);
    const matKhau = matKhauMacDinhTuNgaySinh(
      input.ngay_sinh,
      input.thang_sinh,
      input.nam_sinh,
    );
    const matKhauHash = await bcrypt.hash(matKhau, BCRYPT_SALT_ROUNDS);
    const chuyenMonChuan = Array.from(
      new Set(input.chuyen_mon.map((c) => normalizeNfcName(c)).filter(Boolean)),
    );

    // Cùng lý do đảo thứ tự như dangKy() — xem comment ở đó (chk_nguoi_dung_scope).
    return this.prisma.$transaction(async (tx) => {
      const hocVien = await tx.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: input.ma_dinh_danh_moet,
          ho_ten: hoTenChuan,
          ngay_sinh: input.ngay_sinh,
          thang_sinh: input.thang_sinh,
          nam_sinh: input.nam_sinh,
          chuc_vu: input.chuc_vu,
          don_vi_cong_tac_id: input.don_vi_cong_tac_id,
          so_dien_thoai_lien_he: input.so_dien_thoai_lien_he,
          ghi_chu: input.ghi_chu,
          trang_thai: 'da_duyet',
          nguoi_duyet_id: nguoiImportId,
          cap_duyet_thuc_te: 'quan_tri',
          ngay_duyet: new Date(),
          chuyen_mon: {
            create: chuyenMonChuan.map((c) => ({ chuyen_mon: c })),
          },
        },
      });
      const nguoiDung = await tx.nguoi_dung.create({
        data: {
          ho_ten: hoTenChuan,
          email: null,
          ten_dang_nhap: input.ma_dinh_danh_moet,
          vai_tro: 'hoc_vien',
          don_vi_id: null,
          hoc_vien_id: hocVien.id,
          mat_khau_hash: matKhauHash,
          phai_doi_mat_khau: true,
        },
      });
      return tx.hoc_vien.update({
        where: { id: hocVien.id },
        data: { created_by: nguoiDung.id },
      });
    });
  }
}
