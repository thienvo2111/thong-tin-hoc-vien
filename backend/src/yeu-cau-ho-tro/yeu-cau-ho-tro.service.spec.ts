import { YeuCauHoTroService } from './yeu-cau-ho-tro.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
} from '../common/exceptions/app.exceptions';
import { ThongBaoService } from '../thong-bao/thong-bao.service';

describe('YeuCauHoTroService — phía học viên', () => {
  let service: YeuCauHoTroService;
  let prisma: {
    yeu_cau_ho_tro: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      count: jest.Mock;
    };
    loai_van_de_ho_tro: { findUniqueOrThrow: jest.Mock };
  };
  let thongBao: { guiYeuCauHoTroTraLoi: jest.Mock };

  beforeEach(() => {
    prisma = {
      yeu_cau_ho_tro: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn(),
      },
      loai_van_de_ho_tro: { findUniqueOrThrow: jest.fn() },
    };
    thongBao = { guiYeuCauHoTroTraLoi: jest.fn() };
    service = new YeuCauHoTroService(
      prisma as unknown as PrismaService,
      thongBao as unknown as ThongBaoService,
    );
  });

  it('taoCuaToi -> lưu tinh_huong (trim + NFC), trang_thai cho_xu_ly, gắn hoc_vien_id từ token', async () => {
    prisma.yeu_cau_ho_tro.create.mockResolvedValueOnce({
      id: 'yc-1',
      hoc_vien_id: 'hv-1',
      loai_van_de_id: null,
      tinh_huong: 'Quên mật khẩu',
      trang_thai: 'cho_xu_ly',
      thoi_gian_tao: new Date(),
      thoi_gian_phan_hoi: null,
      loai_van_de: null,
    });

    const ketQua = await service.taoCuaToi('hv-1', {
      tinh_huong: '  Quên mật khẩu ',
      noi_dung_hoi: 'Tôi quên mật khẩu',
    });

    expect(prisma.yeu_cau_ho_tro.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          hoc_vien_id: 'hv-1',
          tinh_huong: 'Quên mật khẩu',
          noi_dung_hoi: 'Tôi quên mật khẩu',
        },
      }),
    );
    expect(prisma.loai_van_de_ho_tro.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(ketQua.chu_de).toBe('Quên mật khẩu');
    expect(ketQua.da_dong_hieu_luc).toBe(false);
    expect(ketQua).not.toHaveProperty('loai_van_de');
  });

  it('ticket cũ không có tinh_huong -> chu_de lấy tên loại vấn đề; không có cả hai -> "Khác"', async () => {
    prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce({
      id: 'yc-cu',
      hoc_vien_id: 'hv-1',
      tinh_huong: null,
      trang_thai: 'cho_xu_ly',
      loai_van_de: { ten: 'Quên mật khẩu' },
    });
    expect((await service.chiTietCuaToi('hv-1', 'yc-cu')).chu_de).toBe(
      'Quên mật khẩu',
    );

    prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce({
      id: 'yc-x',
      hoc_vien_id: 'hv-1',
      tinh_huong: null,
      trang_thai: 'cho_xu_ly',
      loai_van_de: null,
    });
    expect((await service.chiTietCuaToi('hv-1', 'yc-x')).chu_de).toBe('Khác');
  });

  it('chiTietCuaToi với ticket của học viên khác -> ForbiddenAppException', async () => {
    prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce({
      id: 'yc-1',
      hoc_vien_id: 'hv-khac',
      loai_van_de: { ten: 'X' },
    });
    await expect(service.chiTietCuaToi('hv-1', 'yc-1')).rejects.toBeInstanceOf(
      ForbiddenAppException,
    );
  });

  it('chiTietCuaToi không tồn tại -> NotFoundAppException', async () => {
    prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.chiTietCuaToi('hv-1', 'yc-khong-ton-tai'),
    ).rejects.toBeInstanceOf(NotFoundAppException);
  });

  it('da_dong_hieu_luc = true khi da_phan_hoi quá 7 ngày', async () => {
    const quaNgay = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000);
    prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce({
      id: 'yc-1',
      hoc_vien_id: 'hv-1',
      trang_thai: 'da_phan_hoi',
      thoi_gian_phan_hoi: quaNgay,
      loai_van_de: { ten: 'X' },
    });
    const ketQua = await service.chiTietCuaToi('hv-1', 'yc-1');
    expect(ketQua.da_dong_hieu_luc).toBe(true);
  });

  it('da_dong_hieu_luc = false khi da_phan_hoi đúng 7 ngày (chưa quá)', async () => {
    const dung7Ngay = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 1000);
    prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce({
      id: 'yc-1',
      hoc_vien_id: 'hv-1',
      trang_thai: 'da_phan_hoi',
      thoi_gian_phan_hoi: dung7Ngay,
      loai_van_de: { ten: 'X' },
    });
    const ketQua = await service.chiTietCuaToi('hv-1', 'yc-1');
    expect(ketQua.da_dong_hieu_luc).toBe(false);
  });

  it('dongCuaToi trên ticket chưa da_phan_hoi -> ValidationException', async () => {
    prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce({
      id: 'yc-1',
      hoc_vien_id: 'hv-1',
      trang_thai: 'cho_xu_ly',
      loai_van_de: { ten: 'X' },
    });
    await expect(service.dongCuaToi('hv-1', 'yc-1')).rejects.toThrow();
    expect(prisma.yeu_cau_ho_tro.update).not.toHaveBeenCalled();
  });

  // Self-Review plan: loai_van_de.trang_thai = 'ngung' (bị admin tắt) vẫn
  // phải trả về đúng chu_de — toResponse() chỉ đọc .ten, không lọc
  // theo trang_thai của danh mục.
  it('chiTietCuaToi với loai_van_de đã bị tắt (trang_thai=ngung) vẫn trả đúng chu_de', async () => {
    prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce({
      id: 'yc-1',
      hoc_vien_id: 'hv-1',
      trang_thai: 'cho_xu_ly',
      loai_van_de: { ten: 'Quên mật khẩu', trang_thai: 'ngung' },
    });
    const ketQua = await service.chiTietCuaToi('hv-1', 'yc-1');
    expect(ketQua.chu_de).toBe('Quên mật khẩu');
  });
});

describe('YeuCauHoTroService — phía quan_tri', () => {
  let service: YeuCauHoTroService;
  let prisma: {
    yeu_cau_ho_tro: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      count: jest.Mock;
    };
    loai_van_de_ho_tro: { findUniqueOrThrow: jest.Mock };
  };
  let thongBao: { guiYeuCauHoTroTraLoi: jest.Mock };

  beforeEach(() => {
    prisma = {
      yeu_cau_ho_tro: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn(),
      },
      loai_van_de_ho_tro: { findUniqueOrThrow: jest.fn() },
    };
    thongBao = { guiYeuCauHoTroTraLoi: jest.fn() };
    service = new YeuCauHoTroService(
      prisma as unknown as PrismaService,
      thongBao as unknown as ThongBaoService,
    );
  });

  it('danhSachQuanTri lọc da_phan_hoi -> trả lịch sử kèm câu trả lời, tên học viên, người trả lời', async () => {
    prisma.yeu_cau_ho_tro.findMany.mockResolvedValueOnce([
      {
        id: 'yc-1',
        hoc_vien_id: 'hv-1',
        loai_van_de_id: 'lvd-1',
        noi_dung_hoi: 'Quên mật khẩu',
        noi_dung_tra_loi: 'Bấm quên mật khẩu',
        trang_thai: 'da_phan_hoi',
        danh_gia: 'hai_long',
        thoi_gian_phan_hoi: new Date(),
        loai_van_de: { ten: 'Tài khoản' },
        hoc_vien: { ho_ten: 'Bùi Thị A', dang_ky_hoc: [] },
        tra_loi_boi_user: { ho_ten: 'Quản trị B' },
      },
    ]);
    prisma.yeu_cau_ho_tro.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const res = await service.danhSachQuanTri({ trang_thai: 'da_phan_hoi' });

    expect(prisma.yeu_cau_ho_tro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { trang_thai: 'da_phan_hoi' } }),
    );
    expect(res.total).toBe(1);
    expect(res.data[0]).toEqual(
      expect.objectContaining({
        noi_dung_tra_loi: 'Bấm quên mật khẩu',
        danh_gia: 'hai_long',
        hoc_vien_ho_ten: 'Bùi Thị A',
        nguoi_tra_loi_ten: 'Quản trị B',
        chu_de: 'Tài khoản',
        hoi_lai: false,
      }),
    );
    expect(res.data[0]).not.toHaveProperty('hoc_vien');
    expect(res.data[0]).not.toHaveProperty('tra_loi_boi_user');
  });

  it('hỏi lại: ticket có tinh_huong đếm theo tinh_huong; ticket cũ đếm theo loai_van_de_id', async () => {
    const phanHoi = new Date('2026-10-01T00:00:00Z');
    prisma.yeu_cau_ho_tro.findMany.mockResolvedValueOnce([
      {
        id: 'yc-moi',
        hoc_vien_id: 'hv-1',
        loai_van_de_id: null,
        tinh_huong: 'Quên mật khẩu',
        thoi_gian_phan_hoi: phanHoi,
        loai_van_de: null,
        hoc_vien: { ho_ten: 'A', dang_ky_hoc: [] },
        tra_loi_boi_user: null,
      },
      {
        id: 'yc-cu',
        hoc_vien_id: 'hv-1',
        loai_van_de_id: 'lvd-1',
        tinh_huong: null,
        thoi_gian_phan_hoi: phanHoi,
        loai_van_de: { ten: 'Tài khoản' },
        hoc_vien: { ho_ten: 'A', dang_ky_hoc: [] },
        tra_loi_boi_user: null,
      },
    ]);
    prisma.yeu_cau_ho_tro.count
      .mockResolvedValueOnce(2) // tổng
      .mockResolvedValueOnce(1) // yc-moi bị hỏi lại
      .mockResolvedValueOnce(0); // yc-cu không

    const res = await service.danhSachQuanTri({});

    const whereHoiLai = prisma.yeu_cau_ho_tro.count.mock.calls
      .slice(1)
      .map((c) => c[0].where);
    expect(whereHoiLai[0]).toEqual(
      expect.objectContaining({ tinh_huong: 'Quên mật khẩu' }),
    );
    expect(whereHoiLai[0]).not.toHaveProperty('loai_van_de_id');
    expect(whereHoiLai[1]).toEqual(
      expect.objectContaining({ loai_van_de_id: 'lvd-1' }),
    );
    expect(whereHoiLai[1]).not.toHaveProperty('tinh_huong');
    expect(res.data.map((d) => d.hoi_lai)).toEqual([true, false]);
  });

  it('danhSachQuanTri không lọc trạng thái -> where rỗng, ticket chưa trả lời có nguoi_tra_loi_ten null', async () => {
    prisma.yeu_cau_ho_tro.findMany.mockResolvedValueOnce([
      {
        id: 'yc-2',
        trang_thai: 'cho_xu_ly',
        thoi_gian_phan_hoi: null,
        loai_van_de: { ten: 'X' },
        hoc_vien: { ho_ten: 'C', dang_ky_hoc: [] },
        tra_loi_boi_user: null,
      },
    ]);
    prisma.yeu_cau_ho_tro.count.mockResolvedValueOnce(1);

    const res = await service.danhSachQuanTri({});

    expect(prisma.yeu_cau_ho_tro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(res.data[0]).toEqual(
      expect.objectContaining({ nguoi_tra_loi_ten: null, hoi_lai: false }),
    );
  });

  it('traLoi ticket cho_xu_ly -> UPDATE có điều kiện cho_xu_ly, set da_phan_hoi + gọi gửi email', async () => {
    prisma.yeu_cau_ho_tro.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.yeu_cau_ho_tro.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'yc-1',
      trang_thai: 'da_phan_hoi',
      thoi_gian_phan_hoi: new Date(),
      thoi_gian_sua_tra_loi: null,
      loai_van_de: { ten: 'X' },
    });

    await service.traLoi('yc-1', 'qt-1', { noi_dung_tra_loi: 'Đã xử lý' });

    expect(prisma.yeu_cau_ho_tro.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'yc-1', trang_thai: 'cho_xu_ly' },
        data: expect.objectContaining({
          trang_thai: 'da_phan_hoi',
          noi_dung_tra_loi: 'Đã xử lý',
          tra_loi_boi: 'qt-1',
        }),
      }),
    );
    expect(thongBao.guiYeuCauHoTroTraLoi).toHaveBeenCalledWith('yc-1');
  });

  it('traLoi ticket đã có câu trả lời / đã đóng -> ConflictAppException, không gửi mail (ADR 0003 H11)', async () => {
    for (const trang_thai of ['da_phan_hoi', 'da_dong']) {
      prisma.yeu_cau_ho_tro.updateMany.mockResolvedValueOnce({ count: 0 });
      prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce({
        id: 'yc-1',
        trang_thai,
      });
      await expect(
        service.traLoi('yc-1', 'qt-1', { noi_dung_tra_loi: 'Trễ rồi' }),
      ).rejects.toThrow(ConflictAppException);
    }
    expect(thongBao.guiYeuCauHoTroTraLoi).not.toHaveBeenCalled();
  });

  it('traLoi ticket không tồn tại -> NotFoundAppException', async () => {
    prisma.yeu_cau_ho_tro.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.traLoi('x', 'qt-1', { noi_dung_tra_loi: 'a' }),
    ).rejects.toThrow(NotFoundAppException);
  });
});
