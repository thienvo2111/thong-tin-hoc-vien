import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCumHocVienDto } from './create-cum-hoc-vien.dto';

// link_zalo thiếu scheme (vd "google.com") phải tự thêm "https://" rồi mới
// validate — tránh href tương đối khi hiển thị cho học viên (xem lien-ket.util.ts).
async function validateLinkZalo(linkZalo: unknown) {
  const dto = plainToInstance(CreateCumHocVienDto, {
    ten_cum: 'Cụm Long Xuyên',
    link_zalo: linkZalo,
  });
  const loi = await validate(dto);
  return { dto, loi };
}

describe('CreateCumHocVienDto — link_zalo', () => {
  it('"google.com" -> tự thêm https:// và hợp lệ', async () => {
    const { dto, loi } = await validateLinkZalo('google.com');
    expect(loi).toHaveLength(0);
    expect(dto.link_zalo).toBe('https://google.com');
  });

  it('link đã có https:// -> giữ nguyên, hợp lệ', async () => {
    const { dto, loi } = await validateLinkZalo('https://zalo.me/g/x');
    expect(loi).toHaveLength(0);
    expect(dto.link_zalo).toBe('https://zalo.me/g/x');
  });

  it('scheme không an toàn (javascript:) -> bị từ chối', async () => {
    const { loi } = await validateLinkZalo('javascript:alert(1)');
    expect(loi.length).toBeGreaterThan(0);
    expect(loi[0].constraints).toHaveProperty('isUrl');
  });

  it('chuỗi không phải link ("abc def") -> bị từ chối', async () => {
    const { loi } = await validateLinkZalo('abc def');
    expect(loi.length).toBeGreaterThan(0);
    expect(loi[0].constraints).toHaveProperty('isUrl');
  });

  it('không có link_zalo (bỏ qua) -> hợp lệ', async () => {
    const { loi } = await validateLinkZalo(undefined);
    expect(loi).toHaveLength(0);
  });
});
