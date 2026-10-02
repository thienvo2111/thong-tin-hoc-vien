import { Injectable } from '@nestjs/common';
import {
  Prisma,
  loai_su_kien_thong_bao,
  trang_thai_gui_thong_bao,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/pagination-query.dto';
import { getMailTransporter, getTestMessageUrl } from './util/mailer.util';
import { layFrontendUrl } from '../common/utils/token-xac-thuc.util';
import { bienNgayVietNam } from './util/gio-viet-nam.util';
import { LichSuThongBaoQueryDto } from './dto/lich-su-thong-bao-query.dto';
import {
  bangThongTin,
  boCucEmail,
  doanVan,
  e,
  khoiNoiBat,
  nutBam,
} from './mau-email/bo-cuc';
import {
  mauDatLaiMatKhau,
  mauKetQuaHocTap,
  mauLichHoc,
  mauXacNhanHoSo,
} from './mau-email/mau-email';

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
// 2026-10-01: mọi email bọc trong khung HTML chung mau-email/bo-cuc.ts (nhận
// diện HCMUE, chân trang liên hệ boiduongnls@hcmue.edu.vn), dữ liệu động luôn
// qua e() để escape. 3 mẫu chính (đặt lại mật khẩu/lịch học/kết quả) nằm ở
// mau-email/mau-email.ts.
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
      include: {
        chuyen_mon: true,
        cu_tru_tinh: true,
        cu_tru_phuong_xa: true,
        don_vi_cong_tac: true,
        mon_giang_day: true,
      },
    });
    if (!hocVien) return;
    if (!hocVien.email_lien_he) {
      this.canhBaoThieuEmail('hoc_vien_xac_nhan', hocVienId);
      return;
    }

    const { tieuDe, html } = mauXacNhanHoSo({
      hoSo: {
        maDinhDanhMoet: hocVien.ma_dinh_danh_moet,
        hoTen: hocVien.ho_ten,
        ngaySinh: hocVien.ngay_sinh,
        thangSinh: hocVien.thang_sinh,
        namSinh: hocVien.nam_sinh,
        gioiTinh: hocVien.gioi_tinh,
        soDinhDanhCaNhan: hocVien.so_dinh_danh_ca_nhan,
        noiSinh: [
          hocVien.noi_sinh_xa,
          hocVien.noi_sinh_huyen,
          hocVien.noi_sinh_tinh,
        ],
        cuTru: [
          hocVien.cu_tru_phuong_xa?.ten ?? null,
          hocVien.cu_tru_tinh?.ten ?? null,
        ],
        donViCongTac: hocVien.don_vi_cong_tac?.ten_don_vi ?? null,
        chucVu: hocVien.chuc_vu,
        soDienThoai: hocVien.so_dien_thoai_lien_he,
        email: hocVien.email_lien_he,
        trinhDo: hocVien.trinh_do_chuyen_mon,
        trinhDoKhac: hocVien.trinh_do_chuyen_mon_khac,
        chuyenMon: hocVien.chuyen_mon.map((c) => c.chuyen_mon),
        capGiangDay: hocVien.cap_giang_day,
        monGiangDay: hocVien.mon_giang_day?.ten_mon ?? null,
      },
      linkHoSo: `${layFrontendUrl()}/toi/ho-so`,
    });

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'hoc_vien_xac_nhan',
      hocVienId: hocVien.id,
      email: hocVien.email_lien_he,
      tieuDe,
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

    const daDuyet = ketQua === 'da_duyet';
    const html = boCucEmail({
      xemTruoc: daDuyet
        ? 'Hồ sơ của Thầy/Cô đã được duyệt.'
        : 'Hồ sơ của Thầy/Cô chưa được duyệt.',
      nhan: 'HỒ SƠ HỌC VIÊN',
      tieuDe: 'Kết quả duyệt hồ sơ',
      noiDung: [
        doanVan(`Kính gửi Thầy/Cô <b>${e(hocVien.ho_ten)}</b>,`),
        daDuyet
          ? khoiNoiBat('thanh_cong', 'Hồ sơ của Thầy/Cô đã được <b>DUYỆT</b>.')
          : khoiNoiBat(
              'loi',
              `Hồ sơ của Thầy/Cô đã bị <b>TỪ CHỐI</b>.${lyDo ? `<br>Lý do: ${e(lyDo)}` : ''}`,
            ),
        daDuyet
          ? ''
          : doanVan(
              'Vui lòng đăng nhập Cổng thông tin để cập nhật lại hồ sơ theo góp ý.',
            ),
        nutBam('Xem hồ sơ của tôi', `${layFrontendUrl()}/toi/ho-so`),
      ].join(''),
    });

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'hoc_vien_duyet',
      hocVienId: hocVien.id,
      email: hocVien.email_lien_he,
      tieuDe: '[HCMUE-BDNLS] Kết quả duyệt hồ sơ',
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

    const daDuyet = ketQua === 'da_duyet';
    const html = boCucEmail({
      xemTruoc: `Khóa ${khoa.ten_khoa} ${daDuyet ? 'đã được duyệt' : 'bị từ chối'}.`,
      nhan: 'KHÓA BỒI DƯỠNG',
      tieuDe: 'Kết quả duyệt khóa bồi dưỡng',
      noiDung: [
        doanVan('Kính gửi Quý Đơn vị,'),
        khoiNoiBat(
          daDuyet ? 'thanh_cong' : 'loi',
          `Khóa bồi dưỡng <b>${e(khoa.ten_khoa)}</b> (mã ${e(khoa.ma_khoa)}) ${daDuyet ? 'đã được <b>DUYỆT</b>' : 'đã bị <b>TỪ CHỐI</b>'}.`,
        ),
        nutBam(
          'Xem khóa bồi dưỡng',
          `${layFrontendUrl()}/admin/khoa-boi-duong/${khoa.id}`,
        ),
      ].join(''),
    });

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'khoa_boi_duong_duyet',
      hocVienId: null,
      email: nguoiDungTruong.email,
      tieuDe: '[HCMUE-BDNLS] Kết quả duyệt khóa bồi dưỡng',
      html,
    });
  }

  // Chỉ gọi khi phan_lop_hoc_vien import gán lop_id thực sự (xem
  // KhoaBoiDuongService.commitPhanLop) — không gọi cho nhánh chỉ ghi danh.
  //
  // Trả về { chuaCoEmail } (T3, QĐ6) để ImportService đếm
  // so_hoc_vien_chua_co_email trên GET /import/{id} — bỏ qua gửi VÀ không
  // ghi nhat_ky_thong_bao cho học viên chưa có email_lien_he.
  // QĐ10: điều kiện GỬI vẫn giữ nguyên (phải có lớp TRỰC TIẾP), nhưng từ
  // 2026-10-01 NỘI DUNG liệt kê lịch học mọi lớp của đăng ký (trực tiếp/Zoom/
  // VLE) gom theo giai đoạn của khóa — giai đoạn chưa có buổi nào vẫn hiện để
  // học viên thấy đủ lộ trình (mau-email.ts → mauLichHoc).
  async guiDangKyHocPhanLop(
    dangKyHocId: string,
  ): Promise<{ chuaCoEmail: boolean }> {
    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: { id: dangKyHocId },
      include: {
        hoc_vien: true,
        khoa: {
          include: {
            giai_doan: {
              where: { trang_thai: 'active' },
              orderBy: { thu_tu: 'asc' },
            },
          },
        },
        // Phân lớp theo giai đoạn (spec 2026-10-02): lớp được gán theo từng
        // giai đoạn — email chỉ liệt kê buổi thuộc giai đoạn mà học viên được
        // gán đúng lớp đó.
        phan_lop_giai_doan: {
          include: {
            lop: { include: { nhan_su: true, lich_hoc: true } },
          },
        },
      },
    });
    if (!dangKy) return { chuaCoEmail: false };
    const coLopTrucTiep = dangKy.phan_lop_giai_doan.some(
      (p) => p.lop.loai_lop === 'truc_tiep',
    );
    if (!coLopTrucTiep) return { chuaCoEmail: false };
    if (!dangKy.hoc_vien.email_lien_he) {
      this.canhBaoThieuEmail('dang_ky_hoc_phan_lop', dangKy.hoc_vien_id);
      return { chuaCoEmail: true };
    }

    const thuTuLop: Record<string, number> = { truc_tiep: 0, zoom: 1, vle: 2 };
    // 1 lớp có thể được gán ở nhiều giai đoạn -> khử trùng theo lop.id.
    const dsLop = [
      ...new Map(
        dangKy.phan_lop_giai_doan.map((p) => [p.lop.id, p.lop]),
      ).values(),
    ].sort((a, b) => thuTuLop[a.loai_lop] - thuTuLop[b.loai_lop]);
    const lopTheoGiaiDoan = new Map(
      dangKy.phan_lop_giai_doan.map((p) => [p.giai_doan_id, p.lop.id]),
    );
    const buoiHoc = dsLop.flatMap((lop) =>
      lop.lich_hoc
        .filter((l) => lopTheoGiaiDoan.get(l.giai_doan_id) === lop.id)
        .map((l) => ({
          giaiDoanId: l.giai_doan_id,
          loaiLop: lop.loai_lop,
          buoiSo: l.buoi_so,
          batDau: l.thoi_gian_bat_dau,
          ketThuc: l.thoi_gian_ket_thuc,
          diaDiemHoacLink: l.dia_diem_hoac_link,
        })),
    );

    const { tieuDe, html } = mauLichHoc({
      hoTen: dangKy.hoc_vien.ho_ten,
      tenKhoa: dangKy.khoa.ten_khoa,
      maKhoa: dangKy.khoa.ma_khoa,
      lop: dsLop.map((lop) => ({
        loaiLop: lop.loai_lop,
        tenLop: lop.ten_lop,
        nhanSu: lop.nhan_su.map((n) => ({
          hoTen: n.ho_ten,
          vaiTro: n.vai_tro,
          soDienThoai: n.so_dien_thoai,
        })),
      })),
      giaiDoan: dangKy.khoa.giai_doan.map((g) => ({
        thuTu: g.thu_tu,
        ten: g.ten_giai_doan,
        hinhThuc: g.hinh_thuc,
        tuNgay: g.thoi_gian_bat_dau,
        denNgay: g.thoi_gian_ket_thuc,
        buoi: buoiHoc.filter((b) => b.giaiDoanId === g.id),
      })),
      linkLopHoc: `${layFrontendUrl()}/toi/lop-hoc`,
    });

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'dang_ky_hoc_phan_lop',
      hocVienId: dangKy.hoc_vien_id,
      email: dangKy.hoc_vien.email_lien_he,
      tieuDe,
      html,
    });
    return { chuaCoEmail: false };
  }

  async guiDangKyHocKetQua(dangKyHocId: string): Promise<void> {
    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: { id: dangKyHocId },
      include: {
        hoc_vien: true,
        khoa: true,
        ket_qua_giai_doan: { include: { giai_doan: true } },
      },
    });
    if (!dangKy) return;
    if (!dangKy.hoc_vien.email_lien_he) {
      this.canhBaoThieuEmail('dang_ky_hoc_ket_qua', dangKy.hoc_vien_id);
      return;
    }

    const soHoacNull = (d: Prisma.Decimal | null) =>
      d === null ? null : Number(d);
    const { tieuDe, html } = mauKetQuaHocTap({
      hoTen: dangKy.hoc_vien.ho_ten,
      tenKhoa: dangKy.khoa.ten_khoa,
      maKhoa: dangKy.khoa.ma_khoa,
      ketQua: dangKy.ket_qua,
      ngayHoanThanh: dangKy.ngay_hoan_thanh,
      mucDauVao: dangKy.muc_dau_vao,
      mucDauRa: dangKy.muc_dau_ra,
      giaiDoan: dangKy.ket_qua_giai_doan.map((k) => ({
        thuTu: k.giai_doan.thu_tu,
        ten: k.giai_doan.ten_giai_doan,
        tyLeHoanThanh: soHoacNull(k.ty_le_hoan_thanh),
        diem: soHoacNull(k.diem),
      })),
      linkCongThongTin: `${layFrontendUrl()}/toi/lop-hoc`,
    });

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'dang_ky_hoc_ket_qua',
      hocVienId: dangKy.hoc_vien_id,
      email: dangKy.hoc_vien.email_lien_he,
      tieuDe,
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

    const html = boCucEmail({
      xemTruoc: 'Ban Tổ chức đã trả lời yêu cầu hỗ trợ của Thầy/Cô.',
      nhan: 'HỖ TRỢ HỌC VIÊN',
      tieuDe: 'Yêu cầu hỗ trợ đã được trả lời',
      noiDung: [
        doanVan(`Kính gửi Thầy/Cô <b>${e(yeuCau.hoc_vien.ho_ten)}</b>,`),
        doanVan('Yêu cầu hỗ trợ của Thầy/Cô đã được Ban Tổ chức trả lời:'),
        bangThongTin([
          ['Câu hỏi', e(yeuCau.noi_dung_hoi)],
          ['Trả lời', e(yeuCau.noi_dung_tra_loi)],
        ]),
        nutBam('Xem yêu cầu hỗ trợ', `${layFrontendUrl()}/toi/yeu-cau-ho-tro`),
      ].join(''),
    });

    await this.themVaoHangDoiEmail({
      loaiSuKien: 'yeu_cau_ho_tro_tra_loi',
      hocVienId: yeuCau.hoc_vien_id,
      email: yeuCau.hoc_vien.email_lien_he,
      tieuDe: '[HCMUE-BDNLS] Yêu cầu hỗ trợ của bạn đã được trả lời',
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
    const html = boCucEmail({
      xemTruoc: 'Xác minh email liên hệ — liên kết có hiệu lực trong 24 giờ.',
      nhan: 'BẢO MẬT TÀI KHOẢN',
      tieuDe: 'Xác minh email liên hệ',
      noiDung: [
        doanVan(`Kính gửi Thầy/Cô <b>${e(hoTen)}</b>,`),
        doanVan(
          'Thầy/Cô vừa cập nhật email liên hệ trên Cổng thông tin Bồi dưỡng Năng lực số. Vui lòng bấm nút bên dưới để xác minh email này:',
        ),
        nutBam('Xác minh email', link),
        khoiNoiBat(
          'canh_bao',
          'Liên kết có hiệu lực trong <b>24 giờ</b>. Nếu Thầy/Cô không thực hiện thay đổi này, vui lòng bỏ qua email.',
        ),
      ].join(''),
    });
    await this.guiNgayVaGhiNhatKy({
      loaiSuKien: 'email_xac_minh',
      hocVienId,
      email,
      tieuDe: '[HCMUE-BDNLS] Xác minh email liên hệ',
      html,
    });
  }

  async guiDatLaiMatKhau(
    email: string,
    hoTen: string,
    link: string,
    hocVienId: string,
  ): Promise<void> {
    const { tieuDe, html } = mauDatLaiMatKhau({
      hoTen,
      link,
      thoiHanPhut: 30,
    });
    await this.guiNgayVaGhiNhatKy({
      loaiSuKien: 'dat_lai_mat_khau',
      hocVienId,
      email,
      tieuDe,
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
