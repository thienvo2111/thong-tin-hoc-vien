import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().normalize('NFC') : value;

// PATCH /hoc-vien/{id}/ma-dinh-danh-moet (quan_tri, spec 2026-10-09 Q-E).
// Độ dài khác 11/12 chỉ là cảnh báo ở FE — BE chỉ bắt chữ số.
export class SuaMaMoetDto {
  @Transform(trim)
  @IsString()
  @Matches(/^\d+$/, { message: 'Mã định danh MOET chỉ gồm chữ số' })
  @MaxLength(20)
  ma_dinh_danh_moet!: string;

  @Transform(trim)
  @IsString({ message: 'Bắt buộc nhập lý do' })
  @IsNotEmpty({ message: 'Bắt buộc nhập lý do' })
  @MaxLength(500)
  ly_do!: string;
}
