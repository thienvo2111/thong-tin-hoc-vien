import { ThongBaoService } from './thong-bao.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as mailerUtil from './util/mailer.util';

// Mock toàn bộ mailer.util — unit test này KHÔNG gửi email thật (khác
// test/thong-bao.e2e-spec.ts, vốn cố ý dùng Ethereal thật cho ít nhất 1
// luồng). Ở đây chỉ kiểm tra logic xây nội dung + ghi nhat_ky_thong_bao/
// hang_doi_email + hành vi "không bao giờ throw" một cách nhanh, xác định.
jest.mock('./util/mailer.util', () => ({
  getMailTransporter: jest.fn(),
  getTestMessageUrl: jest.fn(() => undefined),
}));

describe('ThongBaoService', () => {
  let service: ThongBaoService;
  let prisma: {
    hoc_vien: { findUnique: jest.Mock };
    nguoi_dung: { findFirst: jest.Mock };
    khoa_boi_duong: { findUnique: jest.Mock };
    dang_ky_hoc: { findUnique: jest.Mock };
    yeu_cau_ho_tro: { findUnique: jest.Mock };
    nhat_ky_thong_bao: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    hang_doi_email: {
      create: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let sendMail: jest.Mock;

  const hocVienDayDu = {
    id: 'hv-1',
    ho_ten: 'Nguyễn Văn A',
    ngay_sinh: 1,
    thang_sinh: 1,
    nam_sinh: 2000,
    so_dien_thoai_lien_he: '0900000000',
    email_lien_he: 'a@test.local',
    chuyen_mon: [{ chuyen_mon: 'Toán' }],
  };

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({ messageId: 'x' });
    (mailerUtil.getMailTransporter as jest.Mock).mockResolvedValue({
      transporter: { sendMail },
      from: 'no-reply@test.local',
    });
    prisma = {
      hoc_vien: { findUnique: jest.fn() },
      nguoi_dung: { findFirst: jest.fn() },
      khoa_boi_duong: { findUnique: jest.fn() },
      dang_ky_hoc: { findUnique: jest.fn() },
      yeu_cau_ho_tro: { findUnique: jest.fn() },
      nhat_ky_thong_bao: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      hang_doi_email: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new ThongBaoService(prisma as unknown as PrismaService);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Làn "hàng loạt" (M9) — các sự kiện dưới đây KHÔNG còn gửi SMTP trực tiếp,
  // chỉ insert 1 dòng hang_doi_email (trang_thai='cho_gui'); việc gửi thật
  // do HangDoiEmailProcessor (cron) đảm nhiệm, xem hang-doi-email.processor.spec.ts.
  describe('guiHocVienXacNhan', () => {
    it('gửi thành công -> ghi hang_doi_email (KHÔNG gọi sendMail, KHÔNG ghi nhat_ky_thong_bao)', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDu);
      await service.guiHocVienXacNhan('hv-1');

      expect(sendMail).not.toHaveBeenCalled();
      expect(prisma.nhat_ky_thong_bao.create).not.toHaveBeenCalled();
      expect(prisma.hang_doi_email.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loai_su_kien: 'hoc_vien_xac_nhan',
          hoc_vien_id: 'hv-1',
          email_nguoi_nhan: 'a@test.local',
        }),
      });
    });

    it('không có email_lien_he -> bỏ qua, không enqueue, không ghi log', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue({
        ...hocVienDayDu,
        email_lien_he: null,
      });
      await service.guiHocVienXacNhan('hv-1');
      expect(prisma.hang_doi_email.create).not.toHaveBeenCalled();
      expect(prisma.nhat_ky_thong_bao.create).not.toHaveBeenCalled();
    });

    it('hoc_vien không tồn tại -> không làm gì, không throw', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(null);
      await expect(
        service.guiHocVienXacNhan('khong-ton-tai'),
      ).resolves.toBeUndefined();
      expect(prisma.hang_doi_email.create).not.toHaveBeenCalled();
    });

    it('insert hang_doi_email thất bại -> vẫn KHÔNG throw (email là side effect)', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDu);
      prisma.hang_doi_email.create.mockRejectedValue(new Error('DB down'));
      await expect(service.guiHocVienXacNhan('hv-1')).resolves.toBeUndefined();
    });
  });

  describe('guiHocVienDuyet', () => {
    it('tu_choi kèm ly_do -> nội dung HTML enqueue chứa lý do', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDu);
      await service.guiHocVienDuyet('hv-1', 'tu_choi', 'Thiếu giấy tờ');
      expect(
        prisma.hang_doi_email.create.mock.calls[0][0].data.noi_dung_html,
      ).toContain('Thiếu giấy tờ');
      expect(prisma.hang_doi_email.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ loai_su_kien: 'hoc_vien_duyet' }),
      });
    });
  });

  describe('guiKhoaBoiDuongDuyet', () => {
    const khoa = {
      id: 'khoa-1',
      ten_khoa: 'Khóa A',
      ma_khoa: 'K1',
      don_vi_to_chuc_id: 'truong-1',
    };

    // Gap 4 (2026-09-28): created_by nay là nguồn CHÍNH — findFirst chỉ là
    // fallback cho dữ liệu cũ (created_by=NULL). Tách rõ 2 nhánh để không lẫn
    // lộn — nhánh created_by phải THẮNG kể cả khi findFirst sẽ trả về một
    // tài khoản khác (chứng minh không còn đoán mò).
    it('khoa.created_by_user có -> dùng trực tiếp, KHÔNG gọi findFirst (gap 4, nguồn chính)', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue({
        ...khoa,
        created_by_user: { id: 'nd-creator', email: 'creator@test.local' },
      });
      // Nếu code vẫn lỡ dùng heuristic, findFirst sẽ trả về 1 tài khoản KHÁC —
      // giúp phát hiện ngay nếu nhánh created_by không thực sự được ưu tiên.
      prisma.nguoi_dung.findFirst.mockResolvedValue({
        id: 'nd-heuristic-sai',
        email: 'sai@test.local',
      });

      await service.guiKhoaBoiDuongDuyet('khoa-1', 'da_duyet');

      expect(prisma.khoa_boi_duong.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ include: { created_by_user: true } }),
      );
      expect(prisma.nguoi_dung.findFirst).not.toHaveBeenCalled();
      expect(prisma.hang_doi_email.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loai_su_kien: 'khoa_boi_duong_duyet',
          hoc_vien_id: null,
          email_nguoi_nhan: 'creator@test.local',
        }),
      });
    });

    it('khoa.created_by_user = null (dữ liệu cũ) -> fallback tìm tài khoản Trường có email', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue({
        ...khoa,
        created_by_user: null,
      });
      prisma.nguoi_dung.findFirst.mockResolvedValue({
        id: 'nd-1',
        email: 'truong@test.local',
      });
      await service.guiKhoaBoiDuongDuyet('khoa-1', 'da_duyet');

      expect(prisma.nguoi_dung.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { vai_tro: 'truong', don_vi_id: 'truong-1' },
        }),
      );
      expect(prisma.hang_doi_email.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loai_su_kien: 'khoa_boi_duong_duyet',
          hoc_vien_id: null,
          email_nguoi_nhan: 'truong@test.local',
        }),
      });
    });

    it('created_by_user = null VÀ không tìm được tài khoản Trường nào -> bỏ qua', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue({
        ...khoa,
        created_by_user: null,
      });
      prisma.nguoi_dung.findFirst.mockResolvedValue(null);
      await service.guiKhoaBoiDuongDuyet('khoa-1', 'da_duyet');
      expect(prisma.hang_doi_email.create).not.toHaveBeenCalled();
    });

    it('created_by_user có nhưng thiếu email -> bỏ qua, KHÔNG rơi xuống fallback', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue({
        ...khoa,
        created_by_user: { id: 'nd-creator', email: null },
      });
      await service.guiKhoaBoiDuongDuyet('khoa-1', 'da_duyet');
      expect(prisma.nguoi_dung.findFirst).not.toHaveBeenCalled();
      expect(prisma.hang_doi_email.create).not.toHaveBeenCalled();
    });
  });

  describe('guiDangKyHocPhanLop (phân lớp theo giai đoạn)', () => {
    it('chưa gán lớp nào -> bỏ qua (không được gọi cho nhánh chỉ ghi danh)', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        hoc_vien_id: 'hv-1',
        hoc_vien: hocVienDayDu,
        khoa: { ten_khoa: 'Khóa A', giai_doan: [] },
        phan_lop_giai_doan: [],
      });
      const res = await service.guiDangKyHocPhanLop('dk-1');
      expect(prisma.hang_doi_email.create).not.toHaveBeenCalled();
      expect(res).toEqual({ chuaCoEmail: false });
    });

    const giaiDoanKhoa = [
      {
        id: 'gd-1',
        thu_tu: 1,
        ten_giai_doan: 'GĐ 1',
        hinh_thuc: 'truc_tiep',
        thoi_gian_bat_dau: new Date('2026-01-02T00:00:00Z'),
        thoi_gian_ket_thuc: new Date('2026-01-03T00:00:00Z'),
      },
      {
        id: 'gd-2',
        thu_tu: 2,
        ten_giai_doan: 'GĐ 2 chưa có lịch',
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: new Date('2026-02-01T00:00:00Z'),
        thoi_gian_ket_thuc: new Date('2026-02-28T00:00:00Z'),
      },
    ];
    const lopTrucTiep = {
      id: 'lop-1',
      loai_lop: 'truc_tiep',
      ten_lop: 'Lớp 1',
      nhan_su: [{ ho_ten: 'GV B', vai_tro: 'giang_vien', so_dien_thoai: null }],
      lich_hoc: [
        {
          giai_doan_id: 'gd-1',
          buoi_so: 1,
          thoi_gian_bat_dau: new Date('2026-01-02T00:30:00Z'),
          thoi_gian_ket_thuc: new Date('2026-01-02T04:00:00Z'),
          dia_diem_hoac_link: 'Hội trường',
        },
      ],
    };
    const lopZoom = {
      id: 'lop-zoom',
      loai_lop: 'zoom',
      ten_lop: 'Zoom 3',
      nhan_su: [],
      lich_hoc: [
        {
          giai_doan_id: 'gd-2',
          buoi_so: 1,
          thoi_gian_bat_dau: new Date('2026-02-02T12:00:00Z'),
          thoi_gian_ket_thuc: new Date('2026-02-02T14:00:00Z'),
          dia_diem_hoac_link: 'https://zoom.us/j/123',
        },
        {
          // buổi của lớp ở GĐ1 — học viên học lớp trực tiếp ở GĐ1, KHÔNG
          // được gán lớp Zoom này ở GĐ1
          giai_doan_id: 'gd-1',
          buoi_so: 1,
          thoi_gian_bat_dau: new Date('2026-01-02T12:00:00Z'),
          thoi_gian_ket_thuc: new Date('2026-01-02T14:00:00Z'),
          dia_diem_hoac_link: 'https://zoom.us/j/khong-duoc-gan',
        },
      ],
    };
    const gan = (giai_doan_id: string, lop: { id: string }) => ({
      giai_doan_id,
      lop_id: lop.id,
      lop,
    });

    it('có lớp trực tiếp -> enqueue lịch học mọi lớp được gán, gom theo giai đoạn; buổi ở GĐ không được gán bị loại', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        hoc_vien_id: 'hv-1',
        hoc_vien: hocVienDayDu,
        khoa: { ten_khoa: 'Khóa A', ma_khoa: 'KA', giai_doan: giaiDoanKhoa },
        // Cùng lớp Zoom gán ở 2 GĐ -> chỉ liệt kê lớp 1 lần.
        phan_lop_giai_doan: [
          gan('gd-1', lopTrucTiep),
          gan('gd-2', lopZoom),
          gan('gd-3', lopZoom),
        ],
      });
      const res = await service.guiDangKyHocPhanLop('dk-1');
      const data = prisma.hang_doi_email.create.mock.calls[0][0].data;
      expect(data.loai_su_kien).toBe('dang_ky_hoc_phan_lop');
      expect(data.tieu_de).toBe('[BDNLS] Lịch học khóa Khóa A');
      expect(data.noi_dung_html).toContain('GV B');
      expect(data.noi_dung_html).toContain('Lớp 1');
      expect(data.noi_dung_html.match(/Zoom 3/g)).toHaveLength(1);
      expect(data.noi_dung_html).toContain('https://zoom.us/j/123');
      expect(data.noi_dung_html).not.toContain('khong-duoc-gan');
      // 00:30Z = 07:30 giờ Việt Nam
      expect(data.noi_dung_html).toContain('07:30 – 11:00');
      expect(data.noi_dung_html).toContain('GĐ 2 chưa có lịch');
      expect(res).toEqual({ chuaCoEmail: false });
    });

    it('chỉ có lớp Zoom, không có lớp trực tiếp -> KHÔNG gửi (giữ điều kiện cũ)', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        hoc_vien_id: 'hv-1',
        hoc_vien: hocVienDayDu,
        khoa: { ten_khoa: 'Khóa A', ma_khoa: 'KA', giai_doan: giaiDoanKhoa },
        phan_lop_giai_doan: [gan('gd-2', lopZoom)],
      });
      const res = await service.guiDangKyHocPhanLop('dk-1');
      expect(prisma.hang_doi_email.create).not.toHaveBeenCalled();
      expect(res).toEqual({ chuaCoEmail: false });
    });

    // T3 (QĐ6): học viên chưa có email_lien_he -> bỏ qua gửi VÀ không ghi
    // nhat_ky_thong_bao/hang_doi_email (không tính là "thất bại") — trả về
    // chuaCoEmail=true để ImportService đếm so_hoc_vien_chua_co_email.
    it('không có email_lien_he -> bỏ qua, không enqueue, chuaCoEmail=true', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        hoc_vien_id: 'hv-1',
        hoc_vien: { ...hocVienDayDu, email_lien_he: null },
        khoa: { ten_khoa: 'Khóa A', giai_doan: [] },
        phan_lop_giai_doan: [gan('gd-1', lopTrucTiep)],
      });
      const res = await service.guiDangKyHocPhanLop('dk-1');
      expect(prisma.hang_doi_email.create).not.toHaveBeenCalled();
      expect(prisma.nhat_ky_thong_bao.create).not.toHaveBeenCalled();
      expect(res).toEqual({ chuaCoEmail: true });
    });
  });

  describe('guiDangKyHocKetQua', () => {
    it('enqueue kèm nhãn kết quả tiếng Việt', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        hoc_vien_id: 'hv-1',
        hoc_vien: hocVienDayDu,
        khoa: { ten_khoa: 'Khóa A', ma_khoa: 'KA' },
        ket_qua: 'dat',
        ngay_hoan_thanh: new Date('2026-01-31T00:00:00Z'),
        muc_dau_vao: 'co_ban',
        muc_dau_ra: 'thanh_thao',
        ket_qua_giai_doan: [
          {
            ty_le_hoan_thanh: new Prisma.Decimal('87.5'),
            diem: null,
            giai_doan: { thu_tu: 1, ten_giai_doan: 'GĐ 1' },
          },
        ],
      });
      await service.guiDangKyHocKetQua('dk-1');
      const html =
        prisma.hang_doi_email.create.mock.calls[0][0].data.noi_dung_html;
      expect(html).toContain('Đạt');
      expect(html).toContain('31/01/2026');
      expect(html).toContain('Thành thạo');
      expect(html).toContain('Hoàn thành 87,5%');
      expect(prisma.hang_doi_email.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ loai_su_kien: 'dang_ky_hoc_ket_qua' }),
      });
    });
  });

  // Làn "hàng loạt" (M9) — ticket hỗ trợ không khẩn như quên mật khẩu, nên
  // enqueue qua hang_doi_email như các luồng guiHocVienXacNhan/... ở trên,
  // KHÔNG dùng guiNgayVaGhiNhatKy (đó là làn "ưu tiên cao" dành cho bảo mật).
  describe('guiYeuCauHoTroTraLoi (M8)', () => {
    it('có email_lien_he -> enqueue hang_doi_email với loai_su_kien đúng', async () => {
      prisma.yeu_cau_ho_tro.findUnique.mockResolvedValue({
        id: 'yc-1',
        hoc_vien_id: 'hv-1',
        noi_dung_hoi: 'Quên mật khẩu',
        noi_dung_tra_loi: 'Liên hệ số hỗ trợ để đặt lại.',
        hoc_vien: {
          id: 'hv-1',
          ho_ten: 'Nguyễn Văn A',
          email_lien_he: 'a@example.com',
        },
      });

      await service.guiYeuCauHoTroTraLoi('yc-1');

      expect(sendMail).not.toHaveBeenCalled();
      expect(prisma.nhat_ky_thong_bao.create).not.toHaveBeenCalled();
      expect(prisma.hang_doi_email.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loai_su_kien: 'yeu_cau_ho_tro_tra_loi',
          hoc_vien_id: 'hv-1',
          email_nguoi_nhan: 'a@example.com',
        }),
      });
    });

    it('không có email_lien_he -> không enqueue, không ghi log, không throw', async () => {
      prisma.yeu_cau_ho_tro.findUnique.mockResolvedValue({
        id: 'yc-2',
        hoc_vien_id: 'hv-2',
        noi_dung_hoi: 'X',
        noi_dung_tra_loi: 'Y',
        hoc_vien: { id: 'hv-2', ho_ten: 'B', email_lien_he: null },
      });

      await expect(
        service.guiYeuCauHoTroTraLoi('yc-2'),
      ).resolves.toBeUndefined();
      expect(prisma.hang_doi_email.create).not.toHaveBeenCalled();
      expect(prisma.nhat_ky_thong_bao.create).not.toHaveBeenCalled();
    });
  });

  // Làn "ưu tiên cao" (M9) — gửi NGAY qua transporter, KHÔNG qua hàng đợi,
  // KHÔNG bị chặn bởi hạn mức/ngày dù đã hết (bảo mật quan trọng hơn) — nhưng
  // từ M9, CÓ ghi nhat_ky_thong_bao (trước đây guiEmailKhongGhiNhatKy không
  // ghi log gì cả).
  describe('guiXacMinhEmail', () => {
    it('gửi ngay (gọi sendMail trực tiếp, KHÔNG enqueue) + ghi nhat_ky_thong_bao', async () => {
      await service.guiXacMinhEmail(
        'a@test.local',
        'Nguyễn Văn A',
        'http://fe/xac-minh-email?token=abc',
        'hv-1',
      );
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'a@test.local' });
      expect(prisma.hang_doi_email.create).not.toHaveBeenCalled();
      expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loai_su_kien: 'email_xac_minh',
          hoc_vien_id: 'hv-1',
          email_nguoi_nhan: 'a@test.local',
          trang_thai: 'thanh_cong',
        }),
      });
    });

    it('vẫn gửi ngay dù hạn mức/ngày đã hết (không bị chặn bởi hạn mức)', async () => {
      jest.spyOn(service, 'tinhHanMucConLaiHomNay').mockResolvedValue(0);
      await service.guiXacMinhEmail(
        'a@test.local',
        'Nguyễn Văn A',
        'http://fe/xac-minh-email?token=abc',
        'hv-1',
      );
      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('sendMail throw -> KHÔNG throw ra ngoài, ghi nhat_ky_thong_bao trang_thai=that_bai', async () => {
      sendMail.mockRejectedValue(new Error('SMTP timeout'));
      await expect(
        service.guiXacMinhEmail('a@test.local', 'A', 'link', 'hv-1'),
      ).resolves.toBeUndefined();
      expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          trang_thai: 'that_bai',
          loi: 'SMTP timeout',
        }),
      });
    });
  });

  describe('guiDatLaiMatKhau', () => {
    it('gửi ngay (gọi sendMail trực tiếp, KHÔNG enqueue) + ghi nhat_ky_thong_bao', async () => {
      await service.guiDatLaiMatKhau(
        'a@test.local',
        'Nguyễn Văn A',
        'http://fe/dat-lai-mat-khau?token=abc',
        'hv-1',
      );
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(prisma.hang_doi_email.create).not.toHaveBeenCalled();
      expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loai_su_kien: 'dat_lai_mat_khau',
          hoc_vien_id: 'hv-1',
          trang_thai: 'thanh_cong',
        }),
      });
    });

    it('vẫn gửi ngay dù hạn mức/ngày đã hết (không bị chặn bởi hạn mức)', async () => {
      jest.spyOn(service, 'tinhHanMucConLaiHomNay').mockResolvedValue(-5);
      await service.guiDatLaiMatKhau(
        'a@test.local',
        'Nguyễn Văn A',
        'link',
        'hv-1',
      );
      expect(sendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('lichSu', () => {
    it('áp filter hoc_vien_id + loai_su_kien, phân trang mặc định', async () => {
      prisma.nhat_ky_thong_bao.findMany.mockResolvedValue([]);
      prisma.nhat_ky_thong_bao.count.mockResolvedValue(0);
      await service.lichSu({
        hoc_vien_id: 'hv-1',
        loai_su_kien: 'hoc_vien_duyet',
      } as never);
      expect(prisma.nhat_ky_thong_bao.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hoc_vien_id: 'hv-1', loai_su_kien: 'hoc_vien_duyet' },
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  describe('demEmailThanhCongHomNay / tinhHanMucConLaiHomNay (M9)', () => {
    const OLD_LIMIT = process.env.EMAIL_DAILY_LIMIT;

    afterEach(() => {
      process.env.EMAIL_DAILY_LIMIT = OLD_LIMIT;
    });

    it('0 email hôm nay -> hạn mức còn lại = EMAIL_DAILY_LIMIT', async () => {
      process.env.EMAIL_DAILY_LIMIT = '2000';
      prisma.nhat_ky_thong_bao.count.mockResolvedValue(0);
      const conLai = await service.tinhHanMucConLaiHomNay(
        new Date('2026-10-01T10:00:00Z'),
      );
      expect(conLai).toBe(2000);
    });

    it('gần đạt hạn mức -> còn lại đúng số dương nhỏ', async () => {
      process.env.EMAIL_DAILY_LIMIT = '2000';
      prisma.nhat_ky_thong_bao.count.mockResolvedValue(1995);
      const conLai = await service.tinhHanMucConLaiHomNay(
        new Date('2026-10-01T10:00:00Z'),
      );
      expect(conLai).toBe(5);
    });

    it('đã vượt hạn mức -> trả về số <= 0 (âm), không chặn tính toán', async () => {
      process.env.EMAIL_DAILY_LIMIT = '2000';
      prisma.nhat_ky_thong_bao.count.mockResolvedValue(2050);
      const conLai = await service.tinhHanMucConLaiHomNay(
        new Date('2026-10-01T10:00:00Z'),
      );
      expect(conLai).toBe(-50);
      expect(conLai).toBeLessThanOrEqual(0);
    });

    it('EMAIL_DAILY_LIMIT để trống -> dùng mặc định 2000', async () => {
      delete process.env.EMAIL_DAILY_LIMIT;
      prisma.nhat_ky_thong_bao.count.mockResolvedValue(0);
      const conLai = await service.tinhHanMucConLaiHomNay(new Date());
      expect(conLai).toBe(2000);
    });

    it('truyền đúng khoảng gui_luc theo giờ Việt Nam cho count (không lẫn email hôm qua)', async () => {
      prisma.nhat_ky_thong_bao.count.mockResolvedValue(0);
      await service.demEmailThanhCongHomNay(new Date('2026-10-01T10:00:00Z'));
      expect(prisma.nhat_ky_thong_bao.count).toHaveBeenCalledWith({
        where: {
          trang_thai: 'thanh_cong',
          gui_luc: {
            gte: new Date('2026-09-30T17:00:00.000Z'),
            lt: new Date('2026-10-01T17:00:00.000Z'),
          },
        },
      });
    });
  });

  describe('trangThaiHangDoi (GET /thong-bao/hang-doi)', () => {
    it('đếm theo trang_thai + hạn mức còn lại hôm nay', async () => {
      process.env.EMAIL_DAILY_LIMIT = '2000';
      prisma.hang_doi_email.count.mockImplementation(
        ({ where }: { where: { trang_thai: string } }) => {
          if (where.trang_thai === 'cho_gui') return Promise.resolve(10);
          if (where.trang_thai === 'thanh_cong') return Promise.resolve(100);
          if (where.trang_thai === 'that_bai') return Promise.resolve(2);
          return Promise.resolve(0);
        },
      );
      prisma.nhat_ky_thong_bao.count.mockResolvedValue(50);

      const res = await service.trangThaiHangDoi();
      expect(res).toEqual({
        theo_trang_thai: { cho_gui: 10, thanh_cong: 100, that_bai: 2 },
        da_gui_hom_nay: 50,
        han_muc_con_lai: 1950,
      });
    });
  });

  // 2026-10-02: tiêu đề thư 5 email phụ có tiền tố [HCMUE-BDNLS] để học viên
  // nhận diện/lọc thư của hệ thống.
  describe('tiền tố tiêu đề [HCMUE-BDNLS]', () => {
    const tieuDeHangDoi = () =>
      prisma.hang_doi_email.create.mock.calls[0][0].data.tieu_de as string;

    it('guiHocVienXacNhan', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDu);
      await service.guiHocVienXacNhan('hv-1');
      expect(tieuDeHangDoi()).toBe(
        '[HCMUE-BDNLS] Xác nhận thông tin đã khai báo',
      );
    });

    it('guiHocVienXacNhan đọc hoc_vien.doi_tuong vào email', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue({
        ...hocVienDayDu,
        doi_tuong: 'can_bo_quan_ly',
      });
      await service.guiHocVienXacNhan('hv-1');
      expect(
        prisma.hang_doi_email.create.mock.calls[0][0].data.noi_dung_html,
      ).toContain('Cán bộ quản lý');
    });

    it.each(['da_duyet', 'tu_choi'] as const)(
      'guiHocVienDuyet (%s)',
      async (kq) => {
        prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDu);
        await service.guiHocVienDuyet('hv-1', kq);
        expect(tieuDeHangDoi()).toBe('[HCMUE-BDNLS] Kết quả duyệt hồ sơ');
      },
    );

    it('guiKhoaBoiDuongDuyet', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue({
        id: 'khoa-1',
        ten_khoa: 'Khóa A',
        ma_khoa: 'KA',
        don_vi_to_chuc_id: 'truong-1',
        created_by_user: { id: 'nd-1', email: 'truong@hcmue.edu.vn' },
      });
      await service.guiKhoaBoiDuongDuyet('khoa-1', 'da_duyet');
      expect(tieuDeHangDoi()).toBe(
        '[HCMUE-BDNLS] Kết quả duyệt khóa bồi dưỡng',
      );
    });

    it('guiYeuCauHoTroTraLoi', async () => {
      prisma.yeu_cau_ho_tro.findUnique.mockResolvedValue({
        id: 'yc-1',
        hoc_vien_id: 'hv-1',
        noi_dung_hoi: 'Hỏi',
        noi_dung_tra_loi: 'Đáp',
        hoc_vien: hocVienDayDu,
      });
      await service.guiYeuCauHoTroTraLoi('yc-1');
      expect(tieuDeHangDoi()).toBe(
        '[HCMUE-BDNLS] Yêu cầu hỗ trợ của bạn đã được trả lời',
      );
    });

    it('guiXacMinhEmail (gửi ngay, tiêu đề ở sendMail + nhật ký)', async () => {
      await service.guiXacMinhEmail(
        'a@test.local',
        'A',
        'https://x/xac-minh-email?token=t',
        'hv-1',
      );
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[HCMUE-BDNLS] Xác minh email liên hệ',
        }),
      );
      expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tieu_de: '[HCMUE-BDNLS] Xác minh email liên hệ',
        }),
      });
    });
  });
});
