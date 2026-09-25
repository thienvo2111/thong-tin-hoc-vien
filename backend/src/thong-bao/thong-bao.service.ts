import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ket_qua_hoc,
  loai_su_kien_thong_bao,
  trang_thai_gui_thong_bao,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/pagination-query.dto';
import { getMailTransporter, getTestMessageUrl } from './util/mailer.util';
import { formatDateVi } from './util/format-date-vi.util';
import { LichSuThongBaoQueryDto } from './dto/lich-su-thong-bao-query.dto';

const KET_QUA_HOC_LABEL: Record<ket_qua_hoc, string> = {
  dang_hoc: 'Đang học',
  dat: 'Đạt',
  khong_dat: 'Không đạt',
  vang: 'Vắng',
};

// Dịch vụ Thông báo — docs/api-contract.md mục 8 + database-ddl.sql PHẦN 4.
// Nội bộ, không có endpoint public trừ GET /thong-bao/lich-su. 5 phương thức
// public dưới đây ứng với đúng 5 giá trị enum loai_su_kien_thong_bao — được
// gọi từ hoc-vien.service.ts / khoa-boi-duong.service.ts (dependency 1
// chiều: các module đó import ThongBaoModule, ThongBaoModule KHÔNG import
// ngược lại — không cần HocVienService/KhoaBoiDuongService, tự truy vấn
// prisma trực tiếp bằng id truyền vào, xem PrismaModule @Global()).
//
// NGUYÊN TẮC "email là side effect" (đã áp dụng cho hoc_vien.xac_nhan ở
// module hoc-vien từ trước): guiVaGhiNhatKy() KHÔNG BAO GIỜ throw — mọi lỗi
// (gửi thất bại HOẶC ghi nhat_ky_thong_bao thất bại) đều bị nuốt và log ra
// console, để nghiệp vụ gọi vào (vd. hồ sơ duyệt) không bao giờ bị rollback
// chỉ vì email lỗi.
//
// PROVISIONAL: nội dung/tiêu đề email dưới đây do tự soạn — api-contract.md
// không định nghĩa nguyên văn nội dung từng loại thông báo, chỉ định nghĩa
// người nhận + ý nghĩa chung (cột "Nội dung" ở mục 8). Flagged trong
// self-review, cùng tinh thần với các chỗ "PROVISIONAL" khác (report shapes
// ở bao-cao module, GET /auth/toi ở auth module).
@Injectable()
export class ThongBaoService {
  constructor(private readonly prisma: PrismaService) {}

  async guiHocVienXacNhan(hocVienId: string): Promise<void> {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id: hocVienId },
      include: { chuyen_mon: true },
    });
    if (!hocVien) return;
    if (!hocVien.email_lien_he) {
      this.canhBaoThieuEmail('hoc_vien_xac_nhan', hocVienId);
      return;
    }

    const chuyenMonText =
      hocVien.chuyen_mon.map((c) => c.chuyen_mon).join(', ') ||
      '(chưa khai báo)';
    const html = `
      <p>Xin chào ${hocVien.ho_ten},</p>
      <p>Đây là bản sao dữ liệu bạn vừa khai báo/xác nhận trên hệ thống Thu thập thông tin học viên:</p>
      <ul>
        <li>Họ và tên: ${hocVien.ho_ten}</li>
        <li>Ngày sinh: ${hocVien.ngay_sinh}/${hocVien.thang_sinh}/${hocVien.nam_sinh}</li>
        <li>Số điện thoại liên hệ: ${hocVien.so_dien_thoai_lien_he}</li>
        <li>Chuyên môn: ${chuyenMonText}</li>
      </ul>
      <p>Nếu có sai sót, vui lòng đăng nhập lại hệ thống để sửa trước khi hồ sơ được duyệt.</p>
    `;

    await this.guiVaGhiNhatKy({
      loaiSuKien: 'hoc_vien_xac_nhan',
      hocVienId: hocVien.id,
      email: hocVien.email_lien_he,
      tieuDe: 'Xác nhận thông tin đã khai báo',
      html,
    });
  }

  async guiHocVienDuyet(
    hocVienId: string,
    ketQua: 'da_duyet' | 'tu_choi',
    lyDo?: string,
  ): Promise<void> {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id: hocVienId },
    });
    if (!hocVien) return;
    if (!hocVien.email_lien_he) {
      this.canhBaoThieuEmail('hoc_vien_duyet', hocVienId);
      return;
    }

    const ketQuaText =
      ketQua === 'da_duyet' ? 'đã được <b>DUYỆT</b>' : 'đã bị <b>TỪ CHỐI</b>';
    const html = `
      <p>Xin chào ${hocVien.ho_ten},</p>
      <p>Hồ sơ của bạn ${ketQuaText}.</p>
      ${ketQua === 'tu_choi' && lyDo ? `<p>Lý do: ${lyDo}</p>` : ''}
    `;

    await this.guiVaGhiNhatKy({
      loaiSuKien: 'hoc_vien_duyet',
      hocVienId: hocVien.id,
      email: hocVien.email_lien_he,
      tieuDe: 'Kết quả duyệt hồ sơ',
      html,
    });
  }

  // Người nhận: KHÔNG phải hoc_vien (nhat_ky_thong_bao.hoc_vien_id = NULL,
  // đúng ghi chú api-contract.md mục 8) mà là tài khoản nguoi_dung của Trường
  // tổ chức khóa. khoa_boi_duong không có cột lưu "tài khoản đã tạo khóa"
  // (không có trong database-ddl.sql) — suy ra bằng nguoi_dung(vai_tro=
  // 'truong', don_vi_id=don_vi_to_chuc_id), lấy tài khoản tạo sớm nhất. Giả
  // định 1 đơn vị Trường có 1 tài khoản đăng nhập vai_tro=truong — khớp với
  // cách các module khác/test fixture đang tạo dữ liệu (1 don_vi <-> 1
  // nguoi_dung truong). Flagged trong self-review — nếu sau này 1 Trường có
  // nhiều tài khoản truong, cần thêm cột created_by thật vào khoa_boi_duong.
  async guiKhoaBoiDuongDuyet(
    khoaId: string,
    ketQua: 'da_duyet' | 'tu_choi',
  ): Promise<void> {
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { id: khoaId },
    });
    if (!khoa) return;

    const nguoiDungTruong = await this.prisma.nguoi_dung.findFirst({
      where: { vai_tro: 'truong', don_vi_id: khoa.don_vi_to_chuc_id },
      orderBy: { created_at: 'asc' },
    });
    if (!nguoiDungTruong?.email) {
      console.warn(
        `[thong-bao] Bỏ qua gửi email khoa_boi_duong_duyet cho khoa_id=${khoaId}: không tìm thấy tài khoản Trường có email`,
      );
      return;
    }

    const ketQuaText =
      ketQua === 'da_duyet' ? 'đã được <b>DUYỆT</b>' : 'đã bị <b>TỪ CHỐI</b>';
    const html = `
      <p>Khóa bồi dưỡng "<b>${khoa.ten_khoa}</b>" (mã ${khoa.ma_khoa}) ${ketQuaText}.</p>
    `;

    await this.guiVaGhiNhatKy({
      loaiSuKien: 'khoa_boi_duong_duyet',
      hocVienId: null,
      email: nguoiDungTruong.email,
      tieuDe: 'Kết quả duyệt khóa bồi dưỡng',
      html,
    });
  }

  // Chỉ gọi khi phan_lop_hoc_vien import gán lop_id thực sự (xem
  // KhoaBoiDuongService.commitPhanLop) — không gọi cho nhánh chỉ ghi danh.
  async guiDangKyHocPhanLop(dangKyHocId: string): Promise<void> {
    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: { id: dangKyHocId },
      include: {
        hoc_vien: true,
        khoa: true,
        lop: {
          include: { nhan_su: true, lich_hoc: { include: { giai_doan: true } } },
        },
      },
    });
    if (!dangKy || !dangKy.lop) return;
    if (!dangKy.hoc_vien.email_lien_he) {
      this.canhBaoThieuEmail('dang_ky_hoc_phan_lop', dangKy.hoc_vien_id);
      return;
    }

    const nhanSuText =
      dangKy.lop.nhan_su
        .map((n) => `${n.ho_ten} (${n.vai_tro === 'giang_vien' ? 'Giảng viên' : 'Hỗ trợ'})`)
        .join(', ') || '(chưa có thông tin)';
    const lichText =
      dangKy.lop.lich_hoc
        .map(
          (l) =>
            `${l.giai_doan.ten_giai_doan}: ${formatDateVi(l.thoi_gian_bat_dau)} - ${formatDateVi(l.thoi_gian_ket_thuc)}${l.dia_diem_hoac_link ? ` tại ${l.dia_diem_hoac_link}` : ''}`,
        )
        .join('<br/>') || '(chưa có lịch học)';

    const html = `
      <p>Xin chào ${dangKy.hoc_vien.ho_ten},</p>
      <p>Bạn đã được phân vào lớp "<b>${dangKy.lop.ten_lop}</b>" thuộc khóa bồi dưỡng "<b>${dangKy.khoa.ten_khoa}</b>".</p>
      <p>Giảng viên/nhân sự lớp: ${nhanSuText}</p>
      <p>Lịch học:<br/>${lichText}</p>
    `;

    await this.guiVaGhiNhatKy({
      loaiSuKien: 'dang_ky_hoc_phan_lop',
      hocVienId: dangKy.hoc_vien_id,
      email: dangKy.hoc_vien.email_lien_he,
      tieuDe: 'Thông báo phân lớp',
      html,
    });
  }

  async guiDangKyHocKetQua(dangKyHocId: string): Promise<void> {
    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: { id: dangKyHocId },
      include: { hoc_vien: true, khoa: true },
    });
    if (!dangKy) return;
    if (!dangKy.hoc_vien.email_lien_he) {
      this.canhBaoThieuEmail('dang_ky_hoc_ket_qua', dangKy.hoc_vien_id);
      return;
    }

    const ketQuaText = dangKy.ket_qua
      ? KET_QUA_HOC_LABEL[dangKy.ket_qua]
      : '(chưa có)';
    const html = `
      <p>Xin chào ${dangKy.hoc_vien.ho_ten},</p>
      <p>Kết quả khóa bồi dưỡng "<b>${dangKy.khoa.ten_khoa}</b>": <b>${ketQuaText}</b>.</p>
      ${dangKy.ngay_hoan_thanh ? `<p>Ngày hoàn thành: ${formatDateVi(dangKy.ngay_hoan_thanh)}</p>` : ''}
    `;

    await this.guiVaGhiNhatKy({
      loaiSuKien: 'dang_ky_hoc_ket_qua',
      hocVienId: dangKy.hoc_vien_id,
      email: dangKy.hoc_vien.email_lien_he,
      tieuDe: 'Kết quả khóa bồi dưỡng',
      html,
    });
  }

  // GET /thong-bao/lich-su — cả 2 filter tùy chọn (docs/api-contract.md mục 8).
  async lichSu(query: LichSuThongBaoQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.nhat_ky_thong_baoWhereInput = {};
    if (query.hoc_vien_id) where.hoc_vien_id = query.hoc_vien_id;
    if (query.loai_su_kien) where.loai_su_kien = query.loai_su_kien;

    const [data, total] = await Promise.all([
      this.prisma.nhat_ky_thong_bao.findMany({
        where,
        orderBy: { gui_luc: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.nhat_ky_thong_bao.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  private canhBaoThieuEmail(
    loaiSuKien: loai_su_kien_thong_bao,
    hocVienId: string,
  ) {
    console.warn(
      `[thong-bao] Bỏ qua gửi email ${loaiSuKien} cho hoc_vien_id=${hocVienId}: hồ sơ chưa có email_lien_he`,
    );
  }

  // Gửi email + ghi 1 dòng nhat_ky_thong_bao dù thành công hay thất bại
  // (database-ddl.sql PHẦN 4 comment: "Ghi nhận MỖI lần gửi"). KHÔNG BAO GIỜ
  // throw ra ngoài — xem comment đầu class.
  private async guiVaGhiNhatKy(params: {
    loaiSuKien: loai_su_kien_thong_bao;
    hocVienId: string | null;
    email: string;
    tieuDe: string;
    html: string;
  }): Promise<void> {
    let trangThai: trang_thai_gui_thong_bao = 'thanh_cong';
    let loi: string | undefined;

    try {
      const { transporter, from } = await getMailTransporter();
      const info = await transporter.sendMail({
        from,
        to: params.email,
        subject: params.tieuDe,
        html: params.html,
      });
      const previewUrl = getTestMessageUrl(info);
      if (previewUrl) {
        console.log(
          `[thong-bao] Xem trước email (Ethereal, ${params.loaiSuKien} -> ${params.email}): ${previewUrl}`,
        );
      }
    } catch (e) {
      trangThai = 'that_bai';
      loi = e instanceof Error ? e.message : 'Lỗi không xác định khi gửi email';
      console.error(
        `[thong-bao] Gửi email thất bại (${params.loaiSuKien} -> ${params.email}): ${loi}`,
      );
    }

    try {
      await this.prisma.nhat_ky_thong_bao.create({
        data: {
          loai_su_kien: params.loaiSuKien,
          hoc_vien_id: params.hocVienId,
          email_nguoi_nhan: params.email,
          tieu_de: params.tieuDe,
          trang_thai: trangThai,
          loi,
        },
      });
    } catch (e) {
      // Ghi log tuyệt đối không được làm hỏng luồng nghiệp vụ đã gọi vào đây
      // (vd. hồ sơ duyệt) — chỉ log ra console, không throw.
      console.error('[thong-bao] Không ghi được nhat_ky_thong_bao', e);
    }
  }
}
