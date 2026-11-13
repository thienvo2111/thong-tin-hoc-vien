import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VleFormThuDto } from './vle-form-thu.dto';

// POST /sso/vle/form-thu (quan_tri) — validate + chuẩn hóa body.
async function kiem(body: Record<string, unknown>) {
  const dto = plainToInstance(VleFormThuDto, body);
  const loi = await validate(dto);
  return { dto, loi: loi.map((e) => e.property) };
}

describe('VleFormThuDto', () => {
  it('username được trim', async () => {
    const { dto, loi } = await kiem({ username: '  thu01  ' });
    expect(loi).toEqual([]);
    expect(dto.username).toBe('thu01');
  });

  it('email được trim + viết thường', async () => {
    const { dto, loi } = await kiem({ email: '  Thu.VLE@X.COM ' });
    expect(loi).toEqual([]);
    expect(dto.email).toBe('thu.vle@x.com');
  });

  it('ô trống/chỉ khoảng trắng coi như không gửi (để service báo "nhập username hoặc email")', async () => {
    const { dto, loi } = await kiem({ username: '   ', email: '' });
    expect(loi).toEqual([]);
    expect(dto.username).toBeUndefined();
    expect(dto.email).toBeUndefined();
  });

  it('username > 100 ký tự bị từ chối', async () => {
    expect((await kiem({ username: 'a'.repeat(101) })).loi).toEqual([
      'username',
    ]);
    expect((await kiem({ username: 'a'.repeat(100) })).loi).toEqual([]);
  });

  it('email sai định dạng hoặc > 255 ký tự bị từ chối', async () => {
    expect((await kiem({ email: 'khong-phai-email' })).loi).toEqual(['email']);
    expect((await kiem({ email: `${'a'.repeat(250)}@x.com` })).loi).toEqual([
      'email',
    ]);
  });

  it.each(['co_ban', 'thanh_thao', 'nang_cao'])(
    'muc %s hợp lệ',
    async (muc) => {
      expect((await kiem({ username: 'u', muc })).loi).toEqual([]);
    },
  );

  it('muc lạ bị từ chối; không gửi muc -> hợp lệ', async () => {
    expect((await kiem({ username: 'u', muc: 'chuyen_gia' })).loi).toEqual([
      'muc',
    ]);
    expect((await kiem({ username: 'u' })).loi).toEqual([]);
  });
});
