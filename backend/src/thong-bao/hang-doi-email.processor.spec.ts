import { HangDoiEmailProcessor } from './hang-doi-email.processor';
import { PrismaService } from '../prisma/prisma.service';
import { ThongBaoService } from './thong-bao.service';
import * as mailerUtil from './util/mailer.util';

jest.mock('./util/mailer.util', () => ({
  getMailTransporter: jest.fn(),
  getTestMessageUrl: jest.fn(() => undefined),
}));

describe('HangDoiEmailProcessor', () => {
  let processor: HangDoiEmailProcessor;
  let prisma: {
    hang_doi_email: { findMany: jest.Mock; update: jest.Mock };
    nhat_ky_thong_bao: { create: jest.Mock };
  };
  let thongBaoService: { tinhHanMucConLaiHomNay: jest.Mock };
  let sendMail: jest.Mock;

  const dongChoGui = (overrides: Record<string, unknown> = {}) => ({
    id: 'hd-1',
    loai_su_kien: 'hoc_vien_xac_nhan',
    hoc_vien_id: 'hv-1',
    email_nguoi_nhan: 'a@test.local',
    tieu_de: 'Xác nhận thông tin đã khai báo',
    noi_dung_html: '<p>Nội dung</p>',
    trang_thai: 'cho_gui',
    so_lan_thu: 0,
    loi: null,
    created_at: new Date('2026-10-01T00:00:00Z'),
    gui_luc: null,
    ...overrides,
  });

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({ messageId: 'x' });
    (mailerUtil.getMailTransporter as jest.Mock).mockResolvedValue({
      transporter: { sendMail },
      from: 'no-reply@test.local',
    });
    prisma = {
      hang_doi_email: { findMany: jest.fn(), update: jest.fn() },
      nhat_ky_thong_bao: { create: jest.fn() },
    };
    thongBaoService = { tinhHanMucConLaiHomNay: jest.fn() };
    processor = new HangDoiEmailProcessor(
      prisma as unknown as PrismaService,
      thongBaoService as unknown as ThongBaoService,
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hạn mức còn đủ -> gửi, cập nhật hang_doi_email=thanh_cong + ghi nhat_ky_thong_bao=thanh_cong', async () => {
    thongBaoService.tinhHanMucConLaiHomNay.mockResolvedValue(100);
    prisma.hang_doi_email.findMany.mockResolvedValue([dongChoGui()]);

    await processor.xuLyHangDoi();

    expect(prisma.hang_doi_email.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trang_thai: 'cho_gui' },
        orderBy: { created_at: 'asc' },
        take: 20,
      }),
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: 'a@test.local',
      subject: 'Xác nhận thông tin đã khai báo',
    });
    expect(prisma.hang_doi_email.update).toHaveBeenCalledWith({
      where: { id: 'hd-1' },
      data: { trang_thai: 'thanh_cong', gui_luc: expect.any(Date) },
    });
    expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loai_su_kien: 'hoc_vien_xac_nhan',
        hoc_vien_id: 'hv-1',
        trang_thai: 'thanh_cong',
      }),
    });
  });

  it('take = min(hạn mức còn lại, 20) khi hạn mức còn lại < 20', async () => {
    thongBaoService.tinhHanMucConLaiHomNay.mockResolvedValue(3);
    prisma.hang_doi_email.findMany.mockResolvedValue([]);

    await processor.xuLyHangDoi();

    expect(prisma.hang_doi_email.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });

  it('hạn mức <= 0 -> không gửi gì, không đọc hàng đợi (giữ nguyên cho_gui)', async () => {
    thongBaoService.tinhHanMucConLaiHomNay.mockResolvedValue(0);

    await processor.xuLyHangDoi();

    expect(prisma.hang_doi_email.findMany).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(prisma.hang_doi_email.update).not.toHaveBeenCalled();
  });

  it('gửi lỗi lần 1 (so_lan_thu 0 -> 1) -> giữ cho_gui, KHÔNG ghi nhat_ky_thong_bao', async () => {
    thongBaoService.tinhHanMucConLaiHomNay.mockResolvedValue(100);
    prisma.hang_doi_email.findMany.mockResolvedValue([
      dongChoGui({ so_lan_thu: 0 }),
    ]);
    sendMail.mockRejectedValue(new Error('SMTP timeout'));

    await processor.xuLyHangDoi();

    expect(prisma.hang_doi_email.update).toHaveBeenCalledWith({
      where: { id: 'hd-1' },
      data: {
        so_lan_thu: 1,
        loi: 'SMTP timeout',
        trang_thai: 'cho_gui',
      },
    });
    expect(prisma.nhat_ky_thong_bao.create).not.toHaveBeenCalled();
  });

  it('gửi lỗi lần 2 (so_lan_thu 1 -> 2) -> vẫn giữ cho_gui, tăng so_lan_thu', async () => {
    thongBaoService.tinhHanMucConLaiHomNay.mockResolvedValue(100);
    prisma.hang_doi_email.findMany.mockResolvedValue([
      dongChoGui({ so_lan_thu: 1 }),
    ]);
    sendMail.mockRejectedValue(new Error('SMTP timeout'));

    await processor.xuLyHangDoi();

    expect(prisma.hang_doi_email.update).toHaveBeenCalledWith({
      where: { id: 'hd-1' },
      data: {
        so_lan_thu: 2,
        loi: 'SMTP timeout',
        trang_thai: 'cho_gui',
      },
    });
    expect(prisma.nhat_ky_thong_bao.create).not.toHaveBeenCalled();
  });

  it('gửi lỗi lần thứ 3 (so_lan_thu 2 -> 3) -> chuyển that_bai + ghi nhat_ky_thong_bao=that_bai', async () => {
    thongBaoService.tinhHanMucConLaiHomNay.mockResolvedValue(100);
    prisma.hang_doi_email.findMany.mockResolvedValue([
      dongChoGui({ so_lan_thu: 2 }),
    ]);
    sendMail.mockRejectedValue(new Error('SMTP timeout'));

    await processor.xuLyHangDoi();

    expect(prisma.hang_doi_email.update).toHaveBeenCalledWith({
      where: { id: 'hd-1' },
      data: {
        so_lan_thu: 3,
        loi: 'SMTP timeout',
        trang_thai: 'that_bai',
        gui_luc: expect.any(Date),
      },
    });
    expect(prisma.nhat_ky_thong_bao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loai_su_kien: 'hoc_vien_xac_nhan',
        hoc_vien_id: 'hv-1',
        trang_thai: 'that_bai',
        loi: 'SMTP timeout',
      }),
    });
  });

  it('lỗi khi tính hạn mức -> không throw ra ngoài', async () => {
    thongBaoService.tinhHanMucConLaiHomNay.mockRejectedValue(
      new Error('DB down'),
    );
    await expect(processor.xuLyHangDoi()).resolves.toBeUndefined();
  });

  it('1 dòng lỗi update DB khi ghi kết quả -> không throw, vẫn xử lý xong lượt', async () => {
    thongBaoService.tinhHanMucConLaiHomNay.mockResolvedValue(100);
    prisma.hang_doi_email.findMany.mockResolvedValue([dongChoGui()]);
    prisma.hang_doi_email.update.mockRejectedValue(new Error('DB down'));

    await expect(processor.xuLyHangDoi()).resolves.toBeUndefined();
  });
});
