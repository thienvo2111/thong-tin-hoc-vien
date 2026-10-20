import { DoiBuoiHocController } from './doi-buoi-hoc.controller';
import { DoiBuoiHocService } from './doi-buoi-hoc.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LocDoiBuoiDto } from './dto/doi-buoi-hoc.dto';

describe('DoiBuoiHocController', () => {
  it('dem-cho-duyet tra object { cho_duyet } (khong tra so tran)', async () => {
    const service = {
      demChoDuyet: jest.fn(async () => 4),
    } as unknown as DoiBuoiHocService;
    const c = new DoiBuoiHocController(service, {} as never);
    await expect(
      c.demChoDuyet({ id: 'u' } as AuthenticatedUser),
    ).resolves.toEqual({
      cho_duyet: 4,
    });
  });
});

describe('LocDoiBuoiDto (bo loc man duyet)', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  const kiem = async (q: Record<string, string>) => {
    const dto = plainToInstance(LocDoiBuoiDto, q);
    const loi = await validate(dto);
    return { dto, loi: loi.map((e) => e.property) };
  };

  it('hop le: cum_id/lop_id uuid, q trim, trang so', async () => {
    const { dto, loi } = await kiem({
      cum_id: uuid,
      lop_id: uuid,
      q: '  Bình ',
      trang: '2',
    });
    expect(loi).toEqual([]);
    expect(dto.q).toBe('Bình');
    expect(dto.trang).toBe(2);
  });

  it('sai: cum_id/lop_id khong phai uuid, q > 100, trang < 1', async () => {
    const { loi } = await kiem({
      cum_id: 'x',
      lop_id: 'y',
      q: 'a'.repeat(101),
      trang: '0',
    });
    expect(loi.sort()).toEqual(['cum_id', 'lop_id', 'q', 'trang']);
  });
});

describe('DoiBuoiHocController bo-loc', () => {
  it('uy quyen service.boLoc(user)', async () => {
    const kq = { khoa: [], cum: [], lop: [] };
    const service = {
      boLoc: jest.fn(async () => kq),
    } as unknown as DoiBuoiHocService;
    const c = new DoiBuoiHocController(service, {} as never);
    const user = { id: 'u' } as AuthenticatedUser;
    await expect(c.boLoc(user)).resolves.toBe(kq);
    expect(service.boLoc).toHaveBeenCalledWith(user);
  });
});
