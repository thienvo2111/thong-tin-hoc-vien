import { YeuCauHoTroService } from './yeu-cau-ho-tro.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenAppException, NotFoundAppException } from '../common/exceptions/app.exceptions';
import { ThongBaoService } from '../thong-bao/thong-bao.service';

describe('YeuCauHoTroService — phía học viên', () => {
  let service: YeuCauHoTroService;
  let prisma: {
    yeu_cau_ho_tro: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
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

  it('taoCuaToi -> tạo với trang_thai cho_xu_ly, gắn hoc_vien_id từ token', async () => {
    prisma.loai_van_de_ho_tro.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'lvd-1',
      ten: 'Quên mật khẩu',
    });
    prisma.yeu_cau_ho_tro.create.mockResolvedValueOnce({
      id: 'yc-1',
      hoc_vien_id: 'hv-1',
      loai_van_de_id: 'lvd-1',
      trang_thai: 'cho_xu_ly',
      thoi_gian_tao: new Date(),
      thoi_gian_phan_hoi: null,
    });

    const ketQua = await service.taoCuaToi('hv-1', {
      loai_van_de_id: 'lvd-1',
      noi_dung_hoi: 'Tôi quên mật khẩu',
    });

    expect(prisma.yeu_cau_ho_tro.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hoc_vien_id: 'hv-1', noi_dung_hoi: 'Tôi quên mật khẩu' }),
      }),
    );
    expect(ketQua.loai_van_de_ten).toBe('Quên mật khẩu');
    expect(ketQua.da_dong_hieu_luc).toBe(false);
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
    await expect(service.chiTietCuaToi('hv-1', 'yc-khong-ton-tai')).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
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
  // phải trả về đúng loai_van_de_ten — toResponse() chỉ đọc .ten, không lọc
  // theo trang_thai của danh mục.
  it('chiTietCuaToi với loai_van_de đã bị tắt (trang_thai=ngung) vẫn trả đúng loai_van_de_ten', async () => {
    prisma.yeu_cau_ho_tro.findUnique.mockResolvedValueOnce({
      id: 'yc-1',
      hoc_vien_id: 'hv-1',
      trang_thai: 'cho_xu_ly',
      loai_van_de: { ten: 'Quên mật khẩu', trang_thai: 'ngung' },
    });
    const ketQua = await service.chiTietCuaToi('hv-1', 'yc-1');
    expect(ketQua.loai_van_de_ten).toBe('Quên mật khẩu');
  });
});
