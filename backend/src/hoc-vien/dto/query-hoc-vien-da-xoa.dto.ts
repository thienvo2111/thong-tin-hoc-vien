import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// GET /hoc-vien/da-xoa (quan_tri, issue #32): nhật ký xóa học viên, chỉ đọc.
// q tìm theo họ tên (không dấu) hoặc mã MOET — cùng quy tắc GET /hoc-vien.
export class QueryHocVienDaXoaDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;
}
