import { ThongBaoService } from './thong-bao.service';
import { PrismaService } from '../prisma/prisma.service';
import * as mailerUtil from './util/mailer.util';

// Mock toàn bộ mailer.util — unit test này KHÔNG gửi email thật (khác
// test/thong-bao.e2e-spec.ts, vốn cố ý dùng Ethereal thật cho ít nhất 1
// luồng). Ở đây chỉ kiểm tra logic xây nội dung + ghi nhat_ky_thong_bao +
// hành vi "không bao giờ throw" một cách nhanh, xác định.
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
    nhat_ky_thong_bao: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
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
      nhat_ky_thong_bao: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
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

  describe('guiHocVienXacNhan', () => {
    it('gửi thành công -> sendMail + ghi nhat_ky_thong_bao trang_thai=thanh_cong', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDu);
      await service.guiHocVienXacNhan('hv-1');

      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0][0]).toMatchObject({
        to: 'a@test.local',
        subject: expect.any(String),
      });
      expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loai_su_kien: 'hoc_vien_xac_nhan',
          hoc_vien_id: 'hv-1',
          email_nguoi_nhan: 'a@test.local',
          trang_thai: 'thanh_cong',
        }),
      });
    });

    it('không có email_lien_he -> bỏ qua, không gửi, không ghi log', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue({
        ...hocVienDayDu,
        email_lien_he: null,
      });
      await service.guiHocVienXacNhan('hv-1');
      expect(sendMail).not.toHaveBeenCalled();
      expect(prisma.nhat_ky_thong_bao.create).not.toHaveBeenCalled();
    });

    it('hoc_vien không tồn tại -> không làm gì, không throw', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(null);
      await expect(service.guiHocVienXacNhan('khong-ton-tai')).resolves.toBeUndefined();
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('sendMail throw -> KHÔNG throw ra ngoài, ghi nhat_ky_thong_bao trang_thai=that_bai kèm lý do', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDu);
      sendMail.mockRejectedValue(new Error('SMTP timeout'));

      await expect(service.guiHocVienXacNhan('hv-1')).resolves.toBeUndefined();

      expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          trang_thai: 'that_bai',
          loi: 'SMTP timeout',
        }),
      });
    });

    it('ghi nhat_ky_thong_bao thất bại -> vẫn KHÔNG throw (email là side effect)', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDu);
      prisma.nhat_ky_thong_bao.create.mockRejectedValue(new Error('DB down'));

      await expect(service.guiHocVienXacNhan('hv-1')).resolves.toBeUndefined();
      expect(sendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('guiHocVienDuyet', () => {
    it('tu_choi kèm ly_do -> nội dung email chứa lý do', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDu);
      await service.guiHocVienDuyet('hv-1', 'tu_choi', 'Thiếu giấy tờ');
      expect(sendMail.mock.calls[0][0].html).toContain('Thiếu giấy tờ');
      expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
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

    it('tìm được tài khoản Trường có email -> gửi, hoc_vien_id=null', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa);
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
      expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loai_su_kien: 'khoa_boi_duong_duyet',
          hoc_vien_id: null,
          email_nguoi_nhan: 'truong@test.local',
        }),
      });
    });

    it('không tìm được tài khoản Trường có email -> bỏ qua', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa);
      prisma.nguoi_dung.findFirst.mockResolvedValue(null);
      await service.guiKhoaBoiDuongDuyet('khoa-1', 'da_duyet');
      expect(sendMail).not.toHaveBeenCalled();
      expect(prisma.nhat_ky_thong_bao.create).not.toHaveBeenCalled();
    });
  });

  describe('guiDangKyHocPhanLop', () => {
    it('lop=null -> bỏ qua (không được gọi cho nhánh chỉ ghi danh)', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        hoc_vien_id: 'hv-1',
        hoc_vien: hocVienDayDu,
        khoa: { ten_khoa: 'Khóa A' },
        lop: null,
      });
      await service.guiDangKyHocPhanLop('dk-1');
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('có lop -> gửi với nội dung nhân sự/lịch học', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        hoc_vien_id: 'hv-1',
        hoc_vien: hocVienDayDu,
        khoa: { ten_khoa: 'Khóa A' },
        lop: {
          ten_lop: 'Lớp 1',
          nhan_su: [{ ho_ten: 'GV B', vai_tro: 'giang_vien' }],
          lich_hoc: [
            {
              thoi_gian_bat_dau: new Date('2026-01-02T00:00:00Z'),
              thoi_gian_ket_thuc: new Date('2026-01-03T00:00:00Z'),
              dia_diem_hoac_link: 'Hội trường',
              giai_doan: { ten_giai_doan: 'GĐ 1' },
            },
          ],
        },
      });
      await service.guiDangKyHocPhanLop('dk-1');
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0][0].html).toContain('GV B');
      expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ loai_su_kien: 'dang_ky_hoc_phan_lop' }),
      });
    });
  });

  describe('guiDangKyHocKetQua', () => {
    it('gửi kèm nhãn kết quả tiếng Việt', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        hoc_vien_id: 'hv-1',
        hoc_vien: hocVienDayDu,
        khoa: { ten_khoa: 'Khóa A' },
        ket_qua: 'dat',
        ngay_hoan_thanh: new Date('2026-01-31T00:00:00Z'),
      });
      await service.guiDangKyHocKetQua('dk-1');
      expect(sendMail.mock.calls[0][0].html).toContain('Đạt');
      expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ loai_su_kien: 'dang_ky_hoc_ket_qua' }),
      });
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
});
