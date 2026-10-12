import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().normalize('NFC') : value;

// DELETE /hoc-vien/{id} (quan_tri, issue #30): xóa cứng 1 học viên.
// xac_nhan = mã MOET (nếu hồ sơ có) hoặc họ tên — so ở service.
export class XoaHocVienDto {
  @Transform(trim)
  @IsString({ message: 'Bắt buộc nhập lý do xóa' })
  @IsNotEmpty({ message: 'Bắt buộc nhập lý do xóa' })
  @MaxLength(1000)
  ly_do!: string;

  @Transform(trim)
  @IsString({ message: 'Bắt buộc nhập nội dung xác nhận' })
  xac_nhan!: string;
}
