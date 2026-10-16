import { DoiBuoiHocController } from './doi-buoi-hoc.controller';
import { DoiBuoiHocService } from './doi-buoi-hoc.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

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
