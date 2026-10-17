import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ThongBaoService } from './thong-bao.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { LichSuThongBaoQueryDto } from './dto/lich-su-thong-bao-query.dto';
import { HangDoiEmailQueryDto } from './dto/hang-doi-email-query.dto';

// Dịch vụ Thông báo — docs/api-contract.md mục 8. Nội bộ, chỉ có endpoint
// public để tra soát lịch sử gửi + xem tình trạng hàng đợi (M9), cả 2 chỉ
// QuảnTrị gọi được.
@Controller('thong-bao')
export class ThongBaoController {
  constructor(private readonly thongBaoService: ThongBaoService) {}

  @Roles('quan_tri')
  @Get('lich-su')
  lichSu(@Query() query: LichSuThongBaoQueryDto) {
    return this.thongBaoService.lichSu(query);
  }

  // M9 (2026-10-01): đếm hang_doi_email theo trang_thai + hạn mức/ngày còn
  // lại (giờ Việt Nam) — tra soát khi nghi ngờ email gửi chậm do đang chờ
  // hàng đợi/hết hạn mức.
  @Roles('quan_tri')
  @Get('hang-doi')
  hangDoi() {
    return this.thongBaoService.trangThaiHangDoi();
  }

  // Màn "Nhật ký email" của Quản trị: danh sách hàng đợi (không kèm HTML) +
  // xem nội dung từng email. 'danh-sach' khai báo trước ':id'.
  @Roles('quan_tri')
  @Get('hang-doi/danh-sach')
  danhSachHangDoi(@Query() query: HangDoiEmailQueryDto) {
    return this.thongBaoService.danhSachHangDoi(query);
  }

  @Roles('quan_tri')
  @Get('hang-doi/:id')
  chiTietHangDoi(@Param('id', ParseUUIDPipe) id: string) {
    return this.thongBaoService.chiTietHangDoi(id);
  }
}
