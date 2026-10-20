import { IsUUID } from 'class-validator';
import { ThongKeQueryDto } from './thong-ke-query.dto';

// ADR 0013: thống kê theo đợt. khoa_id lấy theo đợt — giá trị client gửi bị bỏ qua.
export class NhuCauMucDotQueryDto extends ThongKeQueryDto {
  @IsUUID()
  dot_id!: string;
}
