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
import { bienNgayVietNam } from './util/gio-viet-nam.util';
import { LichSuThongBaoQueryDto } from './dto/lich-su-thong-bao-query.dto';

const KET_QUA_HOC_LABEL: Record<ket_qua_hoc, string> = {
  dang_hoc: 'Đang học',
  dat: 'Đạt',
  khong_dat: 'Không đạt',
  vang: 'Vắng',
};

const EMAIL_DAILY_LIMIT_MAC_DINH = 2000;

// M9 (2026-10-01): hạn mức/ngày đọc từ EMAIL_DAILY_LIMIT (xem .env.example)
// — tự đặt thấp hơn hạn mức thật của Google Workspace để có biên an toàn.
function layGioiHanHangNgay(): number {
  const parsed = parseInt(process.env.EMAIL_DAILY_LIMIT ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : EMAIL_DAILY_LIMIT_MAC_DINH;
}

// Dịch vụ Thông báo — docs/api-contract.md mục 8 + database-ddl.sql PHẦN 4.
// Nội bộ, không có endpoint public trừ GET /thong-bao/lich-su và GET
// /thong-bao/hang-doi. 7 phương thức public gửi email ứng với đúng 7 giá
// trị enum loai_su_kien_thong_bao — được gọi từ hoc-vien.service.ts /
// khoa-boi-duong.service.ts / auth.service.ts (dependency 1 chiều: các
// module đó import ThongBaoModule, ThongBaoModule KHÔNG import ngược lại —
// không cần HocVienService/KhoaBoiDuongService/AuthService, tự truy vấn
// prisma trực tiếp bằng id truyền vào, xem PrismaModule @Global()).
//
// M9 (2026-10-01, hàng đợi + hạn mức email): 2 LÀN gửi, tách theo mức độ
// nhạy cảm thời gian —
//   - "Ưu tiên cao" (guiXacMinhEmail, guiDatLaiMatKhau): bảo mật quan trọng
//     hơn hạn mức, gửi NGAY qua guiNgayVaGhiNhatKy(), không qua hàng đợi,
//     không bị chặn dù hạn mức/ngày đã hết — nhưng VẪN ghi nhat_ky_thong_bao
//     (khác hành vi cũ trước M9) để hạn mức đếm đúng toàn bộ email thực sự
//     gửi qua tài khoản.
//   - "Hàng loạt" (guiHocVienXacNhan, guiHocVienDuyet, guiKhoaBoiDuongDuyet,
//     guiDangKyHocPhanLop, guiDangKyHocKetQua): chỉ INSERT 1 dòng
//     hang_doi_email (trang_thai='cho_gui') qua themVaoHangDoiEmail(), trả
//     về ngay — việc gửi SMTP thật do HangDoiEmailProcessor (cron mỗi phút,
//     cùng thư mục) đảm nhiệm, tự trải qua nhiều ngày khi vượt hạn mức.
//
// NGUYÊN TẮC "email là side effect" (đã áp dụng cho hoc_vien.xac_nhan ở
// module hoc-vien từ trước): CẢ guiNgayVaGhiNhatKy() VÀ themVaoHangDoiEmail()
// KHÔNG BAO GIỜ throw — mọi lỗi (gửi/insert thất bại HOẶC ghi nhat_ky_
// thong_bao thất bại) đều bị nuốt và log ra console, để nghiệp vụ gọi vào
// (vd. hồ sơ duyệt) không bao giờ bị rollback chỉ vì email lỗi.
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

    await this.themVaoHangDoiEmail({
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

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'hoc_vien_duyet',
      hocVienId: hocVien.id,
      email: hocVien.email_lien_he,
      tieuDe: 'Kết quả duyệt hồ sơ',
      html,
    });
  }

  // Người nhận: KHÔNG phải hoc_vien (nhat_ky_thong_bao.hoc_vien_id = NULL,
  // đúng ghi chú api-contract.md mục 8) mà là tài khoản nguoi_dung của Trường
  // tổ chức khóa. Gap 4 (2026-09-28): khoa_boi_duong.created_by nay ghi rõ
  // đúng tài khoản đã gọi POST /khoa-boi-duong — dùng trực tiếp, đơn giản hơn
  // hẳn heuristic cũ. Fallback về heuristic cũ (findFirst tài khoản truong
  // trong đơn vị) CHỈ khi created_by = NULL (dữ liệu cũ tạo trước migration
  // này, không truy ngược được) để không phá test/dữ liệu có sẵn.
  async guiKhoaBoiDuongDuyet(
    khoaId: string,
    ketQua: 'da_duyet' | 'tu_choi',
  ): Promise<void> {
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { id: khoaId },
      include: { created_by_user: true },
    });
    if (!khoa) return;

    const nguoiDungTruong =
      khoa.created_by_user ??
      (await this.prisma.nguoi_dung.findFirst({
        where: { vai_tro: 'truong', don_vi_id: khoa.don_vi_to_chuc_id },
        orderBy: { created_at: 'asc' },
      }));
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

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'khoa_boi_duong_duyet',
      hocVienId: null,
      email: nguoiDungTruong.email,
      tieuDe: 'Kết quả duyệt khóa bồi dưỡng',
      html,
    });
  }

  // Chỉ gọi khi phan_lop_hoc_vien import gán lop_id thực sự (xem
  // KhoaBoiDuongService.commitPhanLop) — không gọi cho nhánh chỉ ghi danh.
  //
  // Trả về { chuaCoEmail } (T3, QĐ6) để ImportService đếm
  // so_hoc_vien_chua_co_email trên GET /import/{id} — bỏ qua gửi VÀ không
  // ghi nhat_ky_thong_bao cho học viên chưa có email_lien_he (đã đúng hành
  // vi từ trước qua canhBaoThieuEmail(), chỉ thêm giá trị trả về ở đây).
  // QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30): dang_ky_hoc.lop_id/lop (1 lớp
  // duy nhất/đăng ký) đã bị xóa, thay bằng dang_ky_hoc_lop (bảng nối, 3 loại
  // lớp độc lập) — lấy đúng lớp TRỰC TIẾP qua where loai_lop='truc_tiep',
  // GIỮ NGUYÊN hành vi cũ (email phân lớp chỉ gắn với lớp trực tiếp, chưa mở
  // rộng sang zoom/vle).
  async guiDangKyHocPhanLop(
    dangKyHocId: string,
  ): Promise<{ chuaCoEmail: boolean }> {
    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: { id: dangKyHocId },
      include: {
        hoc_vien: true,
        khoa: true,
        dang_ky_hoc_lop: {
          where: { loai_lop: 'truc_tiep' },
          include: {
            lop: {
              include: {
                nhan_su: true,
                lich_hoc: { include: { giai_doan: true } },
              },
            },
          },
        },
      },
    });
    const lopTrucTiep = dangKy?.dang_ky_hoc_lop[0]?.lop;
    if (!dangKy || !lopTrucTiep) return { chuaCoEmail: false };
    if (!dangKy.hoc_vien.email_lien_he) {
      this.canhBaoThieuEmail('dang_ky_hoc_phan_lop', dangKy.hoc_vien_id);
      return { chuaCoEmail: true };
    }

    const nhanSuText =
      lopTrucTiep.nhan_su
        .map(
          (n) =>
            `${n.ho_ten} (${n.vai_tro === 'giang_vien' ? 'Giảng viên' : 'Hỗ trợ'})`,
        )
        .join(', ') || '(chưa có thông tin)';
    const lichText =
      lopTrucTiep.lich_hoc
        .map(
          (l) =>
            `${l.giai_doan.ten_giai_doan}: ${formatDateVi(l.thoi_gian_bat_dau)} - ${formatDateVi(l.thoi_gian_ket_thuc)}${l.dia_diem_hoac_link ? ` tại ${l.dia_diem_hoac_link}` : ''}`,
        )
        .join('<br/>') || '(chưa có lịch học)';

    const html = `
      <p>Xin chào ${dangKy.hoc_vien.ho_ten},</p>
      <p>Bạn đã được phân vào lớp "<b>${lopTrucTiep.ten_lop}</b>" thuộc khóa bồi dưỡng "<b>${dangKy.khoa.ten_khoa}</b>".</p>
      <p>Giảng viên/nhân sự lớp: ${nhanSuText}</p>
      <p>Lịch học:<br/>${lichText}</p>
    `;

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'dang_ky_hoc_phan_lop',
      hocVienId: dangKy.hoc_vien_id,
      email: dangKy.hoc_vien.email_lien_he,
      tieuDe: 'Thông báo phân lớp',
      html,
    });
    return { chuaCoEmail: false };
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

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'dang_ky_hoc_ket_qua',
      hocVienId: dangKy.hoc_vien_id,
      email: dangKy.hoc_vien.email_lien_he,
      tieuDe: 'Kết quả khóa bồi dưỡng',
      html,
    });
  }

  // M8 (2026-10-01): báo học viên khi ticket "Yêu cầu hỗ trợ" được quan_tri
  // trả lời — ticket hỗ trợ không khẩn như quên mật khẩu/xác minh email, nên
  // đi làn "hàng loạt" (themVaoHangDoiEmail), không phải "ưu tiên cao".
  async guiYeuCauHoTroTraLoi(yeuCauId: string): Promise<void> {
    const yeuCau = await this.prisma.yeu_cau_ho_tro.findUnique({
      where: { id: yeuCauId },
      include: { hoc_vien: true },
    });
    if (!yeuCau) return;
    if (!yeuCau.hoc_vien.email_lien_he) {
      this.canhBaoThieuEmail('yeu_cau_ho_tro_tra_loi', yeuCau.hoc_vien_id);
      return;
    }

    const html = `
      <p>Xin chào ${yeuCau.hoc_vien.ho_ten},</p>
      <p>Yêu cầu hỗ trợ của bạn đã được trả lời:</p>
      <p><b>Câu hỏi:</b> ${yeuCau.noi_dung_hoi}</p>
      <p><b>Trả lời:</b> ${yeuCau.noi_dung_tra_loi}</p>
      <p>Đăng nhập hệ thống, vào mục "Yêu cầu hỗ trợ" để xem chi tiết.</p>
    `;

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'yeu_cau_ho_tro_tra_loi',
      hocVienId: yeuCau.hoc_vien_id,
      email: yeuCau.hoc_vien.email_lien_he,
      tieuDe: 'Yêu cầu hỗ trợ của bạn đã được trả lời',
      html,
    });
  }

  // Thêm 2026-09-30, sửa M9 (2026-10-01): xác minh email liên hệ & quên/đặt
  // lại mật khẩu — làn "ưu tiên cao", gửi NGAY (không qua hàng đợi, không bị
  // chặn bởi hạn mức/ngày dù đã hết) vì bảo mật quan trọng hơn. Từ M9, CÓ ghi
  // nhat_ky_thong_bao (trước đây không ghi gì) để hạn mức đếm đúng toàn bộ
  // email thực sự gửi qua tài khoản — cần hocVienId để ghi cột hoc_vien_id.
  async guiXacMinhEmail(
    email: string,
    hoTen: string,
    link: string,
    hocVienId: string,
  ): Promise<void> {
    const html = `
      <p>Xin chào ${hoTen},</p>
      <p>Thầy/Cô vừa cập nhật email liên hệ trên hệ thống Thu thập thông tin học viên. Vui lòng bấm vào liên kết dưới đây để xác minh email này (liên kết có hiệu lực trong 24 giờ):</p>
      <p><a href="${link}">${link}</a></p>
      <p>Nếu Thầy/Cô không thực hiện thay đổi này, vui lòng bỏ qua email.</p>
    `;
    await this.guiNgayVaGhiNhatKy({
      loaiSuKien: 'email_xac_minh',
      hocVienId,
      email,
      tieuDe: 'Xác minh email liên hệ',
      html,
    });
  }

  async guiDatLaiMatKhau(
    email: string,
    hoTen: string,
    link: string,
    hocVienId: string,
  ): Promise<void> {
    const html = `
      <p>Xin chào ${hoTen},</p>
      <p>Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản của Thầy/Cô. Bấm vào liên kết dưới đây để đặt mật khẩu mới (liên kết có hiệu lực trong 30 phút):</p>
      <p><a href="${link}">${link}</a></p>
      <p>Nếu Thầy/Cô không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.</p>
    `;
    await this.guiNgayVaGhiNhatKy({
      loaiSuKien: 'dat_lai_mat_khau',
      hocVienId,
      email,
      tieuDe: 'Đặt lại mật khẩu',
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

  // GET /thong-bao/hang-doi — M9, QuảnTrị xem tình trạng hàng đợi + hạn mức.
  async trangThaiHangDoi(): Promise<{
    theo_trang_thai: { cho_gui: number; thanh_cong: number; that_bai: number };
    da_gui_hom_nay: number;
    han_muc_con_lai: number;
  }> {
    const [choGui, thanhCong, thatBai, daGuiHomNay] = await Promise.all([
      this.prisma.hang_doi_email.count({ where: { trang_thai: 'cho_gui' } }),
      this.prisma.hang_doi_email.count({
        where: { trang_thai: 'thanh_cong' },
      }),
      this.prisma.hang_doi_email.count({ where: { trang_thai: 'that_bai' } }),
      this.demEmailThanhCongHomNay(),
    ]);
    return {
      theo_trang_thai: {
        cho_gui: choGui,
        thanh_cong: thanhCong,
        that_bai: thatBai,
      },
      da_gui_hom_nay: daGuiHomNay,
      han_muc_con_lai: layGioiHanHangNgay() - daGuiHomNay,
    };
  }

  // Dùng bởi HangDoiEmailProcessor (cron) VÀ trangThaiHangDoi() ở trên — số
  // email trang_thai=thanh_cong có gui_luc rơi vào "hôm nay" theo giờ Việt
  // Nam (Asia/Ho_Chi_Minh, UTC+7 — KHÔNG dùng UTC thô, xem gio-viet-nam.util.ts).
  async demEmailThanhCongHomNay(thoiDiem: Date = new Date()): Promise<number> {
    const { tuNgay, denNgay } = bienNgayVietNam(thoiDiem);
    return this.prisma.nhat_ky_thong_bao.count({
      where: {
        trang_thai: 'thanh_cong',
        gui_luc: { gte: tuNgay, lt: denNgay },
      },
    });
  }

  // Hạn mức CÒN LẠI hôm nay = EMAIL_DAILY_LIMIT - số email thanh_cong đã gửi
  // hôm nay. Có thể âm hoặc 0 — HangDoiEmailProcessor coi <= 0 là "hết hạn
  // mức, không gửi gì thêm trong lượt này".
  async tinhHanMucConLaiHomNay(thoiDiem: Date = new Date()): Promise<number> {
    const daGui = await this.demEmailThanhCongHomNay(thoiDiem);
    return layGioiHanHangNgay() - daGui;
  }

  private canhBaoThieuEmail(
    loaiSuKien: loai_su_kien_thong_bao,
    hocVienId: string,
  ) {
    console.warn(
      `[thong-bao] Bỏ qua gửi email ${loaiSuKien} cho hoc_vien_id=${hocVienId}: hồ sơ chưa có email_lien_he`,
    );
  }

  // Làn "ưu tiên cao" — gửi NGAY qua transporter + ghi 1 dòng nhat_ky_
  // thong_bao dù thành công hay thất bại (database-ddl.sql PHẦN 4 comment:
  // "Ghi nhận MỖI lần gửi"). KHÔNG BAO GIỜ throw ra ngoài — xem comment đầu
  // class. Trước M9 đây là guiEmailKhongGhiNhatKy() (không ghi log) — hợp
  // nhất với guiVaGhiNhatKy() cũ vì logic gửi+ghi log giống nhau 100%, chỉ
  // khác nguồn gọi.
  private async guiNgayVaGhiNhatKy(params: {
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

  // Làn "hàng loạt" (M9) — KHÔNG gửi SMTP ở đây, chỉ insert 1 dòng
  // hang_doi_email (trang_thai='cho_gui') rồi trả về ngay; HangDoiEmail
  // Processor (cron mỗi phút) đảm nhiệm gửi thật + ghi nhat_ky_thong_bao khi
  // có kết quả cuối (thành công hoặc thất bại hẳn sau 3 lần thử). KHÔNG BAO
  // GIỜ throw ra ngoài — cùng nguyên tắc "email là side effect".
  private async themVaoHangDoiEmail(params: {
    loaiSuKien: loai_su_kien_thong_bao;
    hocVienId: string | null;
    email: string;
    tieuDe: string;
    html: string;
  }): Promise<void> {
    try {
      await this.prisma.hang_doi_email.create({
        data: {
          loai_su_kien: params.loaiSuKien,
          hoc_vien_id: params.hocVienId,
          email_nguoi_nhan: params.email,
          tieu_de: params.tieuDe,
          noi_dung_html: params.html,
        },
      });
    } catch (e) {
      console.error('[thong-bao] Không ghi được hang_doi_email', e);
    }
  }
}
