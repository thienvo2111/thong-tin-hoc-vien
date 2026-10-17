import { HoTroGiangVienController } from './ho-tro-giang-vien.controller';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// ADR 0009: mọi route email lịch giảng dạy kiểm khóa trong nhóm TRƯỚC khi gọi service.
describe('HoTroGiangVienController — email lịch giảng dạy', () => {
  const user = { id: 'u1', vai_tro: 'ho_tro_giang_vien' } as AuthenticatedUser;
  let prisma: any;
  let scope: any;
  let emailLichDay: any;
  let ctrl: HoTroGiangVienController;

  beforeEach(() => {
    prisma = { khoa_boi_duong: { findMany: jest.fn().mockResolvedValue([]) } };
    scope = {
      damBaoKhoaTrongPhamVi: jest.fn().mockResolvedValue(undefined),
      khoaIdsCuaToi: jest.fn().mockResolvedValue(['k1']),
    };
    emailLichDay = {
      danhSach: jest.fn().mockResolvedValue({ giang_vien: [] }),
      xemTruoc: jest.fn().mockResolvedValue({}),
      gui: jest.fn().mockResolvedValue({ da_xep_hang: 0, bo_qua: [] }),
    };
    const khac = {} as never;
    ctrl = new HoTroGiangVienController(
      prisma,
      scope,
      khac,
      khac,
      khac,
      khac,
      khac,
      khac,
      khac,
      khac,
      emailLichDay,
    );
  });

  it('GET khoa: chỉ khóa trong nhóm, kèm giai đoạn đang hoạt động theo thứ tự', async () => {
    await ctrl.khoaCuaToi(user);
    const arg = prisma.khoa_boi_duong.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: { in: ['k1'] } });
    expect(arg.select.giai_doan.where).toEqual({ trang_thai: 'active' });
    expect(arg.select.giai_doan.orderBy).toEqual({ thu_tu: 'asc' });
  });

  it('khóa ngoài phạm vi -> 404, service không được gọi', async () => {
    scope.damBaoKhoaTrongPhamVi.mockRejectedValue(
      new NotFoundAppException('Không tìm thấy khóa bồi dưỡng'),
    );
    await expect(ctrl.dsEmailLichDay('k9', 'gd', user)).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
    await expect(
      ctrl.xemTruocEmailLichDay('k9', 'gd', 'gv', user),
    ).rejects.toBeInstanceOf(NotFoundAppException);
    await expect(
      ctrl.guiEmailLichDay('k9', 'gd', { giang_vien_ids: ['gv'] }, user),
    ).rejects.toBeInstanceOf(NotFoundAppException);
    expect(emailLichDay.danhSach).not.toHaveBeenCalled();
    expect(emailLichDay.xemTruoc).not.toHaveBeenCalled();
    expect(emailLichDay.gui).not.toHaveBeenCalled();
  });

  it('trong phạm vi -> chuyển đúng tham số cho service', async () => {
    await ctrl.dsEmailLichDay('k1', 'gd', user);
    await ctrl.xemTruocEmailLichDay('k1', 'gd', 'gv', user);
    await ctrl.guiEmailLichDay('k1', 'gd', { giang_vien_ids: ['gv'] }, user);
    expect(scope.damBaoKhoaTrongPhamVi).toHaveBeenCalledWith('u1', 'k1');
    expect(emailLichDay.danhSach).toHaveBeenCalledWith('k1', 'gd');
    expect(emailLichDay.xemTruoc).toHaveBeenCalledWith('k1', 'gd', 'gv');
    expect(emailLichDay.gui).toHaveBeenCalledWith(user, 'k1', 'gd', ['gv']);
  });
});
