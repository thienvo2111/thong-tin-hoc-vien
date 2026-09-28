import { IsNotEmpty, IsString } from 'class-validator';

// GET /nguoi-dung?q= — mo-rong-nls-an-giang.md mục T1 ("N4 tra tài khoản
// khi học viên gọi hỗ trợ").
export class TimKiemNguoiDungQueryDto {
  @IsString()
  @IsNotEmpty()
  q: string;
}
