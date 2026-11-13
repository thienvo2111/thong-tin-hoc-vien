import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Put,
  Logger,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { NguoiDungThrottlerGuard } from '../common/guards/nguoi-dung-throttler.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { SsoService } from './sso.service';
import { CapMaSsoDto, DoiMaSsoDto, MaThuSsoDto } from './dto/sso.dto';
import { KetQuaKhaoSatService } from './ket-qua-khao-sat.service';
import { ThangMucService } from './thang-muc.service';
import { VleService } from './vle.service';
import { LuuThangMucDto } from './dto/thang-muc.dto';
import { VleFormThuDto } from './dto/vle-form-thu.dto';
import { kiemTraApiKeyKhaoSat } from './sso-api-key';
import {
  BaoKetQuaDto,
  QueryTinhHinhKhaoSatDto,
  ThongKeKhaoSatDto,
  TRUONG_BAO_KET_QUA,
} from './dto/ket-qua-khao-sat.dto';

// SSO sang hệ thống khảo sát (2026-10-02). @Roles đặt ở từng method — @Roles
// cấp class sẽ chặn luôn route @Public() (xem cau-hinh-khao-sat.controller.ts).
@Controller('sso')
export class SsoController {
  private readonly logger = new Logger(SsoController.name);

  constructor(
    private readonly ssoService: SsoService,
    private readonly ketQuaKhaoSat: KetQuaKhaoSatService,
    private readonly thangMuc: ThangMucService,
    private readonly vleService: VleService,
  ) {}

  @Roles('hoc_vien')
  @Post('cap-ma')
  capMa(@Body() dto: CapMaSsoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ssoService.capMa(user, dto.target);
  }

  // Mã THỬ để tích hợp (quản trị) — xem SsoService.taoMaThu.
  @Roles('quan_tri')
  @Post('ma-thu')
  maThu(@Body() dto: MaThuSsoDto) {
    return this.ssoService.taoMaThu(dto.ma_dinh_danh_moet.trim(), dto.target);
  }

  // Gọi từ MÁY CHỦ hệ thống khảo sát (server-to-server), không phải trình
  // duyệt: không có JWT, xác thực bằng header X-API-Key.
  @Public()
  @Post('doi-ma')
  @HttpCode(200)
  doiMa(@Body() dto: DoiMaSsoDto, @Headers('x-api-key') apiKey?: string) {
    return this.ssoService.doiMa(apiKey, dto.code);
  }

  // Máy chủ khảo sát báo trạng thái / kết quả về cổng (2026-10-04).
  @Public()
  @Post('ket-qua')
  @HttpCode(200)
  async baoKetQua(
    @Body() dto: BaoKetQuaDto,
    @Req() req: Request,
    @Headers('x-api-key') apiKey?: string,
  ) {
    kiemTraApiKeyKhaoSat(apiKey);
    const kq = await this.ketQuaKhaoSat.nhanKetQua(dto);
    // Trường lạ (vd gửi "tong_diem" thay vì "diem") bị bỏ âm thầm -> trả lại + ghi log để 2 bên phát hiện.
    const boQua = Object.keys((req.body ?? {}) as object).filter(
      (k) => !(TRUONG_BAO_KET_QUA as readonly string[]).includes(k),
    );
    if (boQua.length === 0) return kq;
    this.logger.warn(`POST /sso/ket-qua bỏ qua trường lạ: ${boQua.join(', ')}`);
    return { ...kq, bo_qua: boQua };
  }

  // Học viên xem tình hình làm khảo sát của mình (không có điểm chi tiết).
  @Roles('hoc_vien')
  @Get('tinh-trang')
  tinhTrang(@CurrentUser() user: AuthenticatedUser) {
    return this.ketQuaKhaoSat.tinhTrangCuaHocVien(user.hoc_vien_id!);
  }

  @Roles('quan_tri')
  @Get('ket-qua/thong-ke')
  thongKe(@Query() query: ThongKeKhaoSatDto) {
    return this.ketQuaKhaoSat.thongKe(query.khoa_id);
  }

  @Roles('quan_tri')
  @Get('ket-qua')
  danhSach(@Query() query: QueryTinhHinhKhaoSatDto) {
    return this.ketQuaKhaoSat.danhSach(query);
  }

  // Thang mức kết quả khảo sát (2026-10-05) — mã + nhãn, quản trị sửa ở trang Cấu hình khảo sát.
  @Roles('quan_tri')
  @Get('thang-muc')
  layThangMuc() {
    return this.thangMuc.lay();
  }

  @Roles('quan_tri')
  @Put('thang-muc')
  luuThangMuc(
    @Body() dto: LuuThangMucDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.thangMuc.luu(dto.muc, user.id);
  }

  // Vào học VLE (external-login P.CNTT, 2026-11-10, api-contract.md mục
  // 10.2). Route PHẢI nằm dưới /sso — Nginx đã proxy sẵn prefix này.
  @Roles('hoc_vien')
  @Get('vle/trang-thai')
  vleTrangThai(@CurrentUser() user: AuthenticatedUser) {
    return this.vleService.trangThai(user);
  }

  // Giới hạn tần suất THEO TÀI KHOẢN (không phải IP) — nhiều học viên có
  // thể chung 1 phòng máy/NAT trường, đếm theo IP sẽ chặn chung cả phòng.
  @Roles('hoc_vien')
  @UseGuards(NguoiDungThrottlerGuard)
  @Post('vle/form')
  vleForm(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.vleService.form(user, req.ip ?? null);
  }

  // Quản trị thử vào VLE với username/email bất kỳ + mức (kiểm VLE_COURSE_MAP
  // trên production) — không cần tài khoản học viên, bỏ qua công tắc khóa.
  @Roles('quan_tri')
  @UseGuards(NguoiDungThrottlerGuard)
  @Post('vle/form-thu')
  vleFormThu(
    @Body() dto: VleFormThuDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.vleService.formThu(user, dto, req.ip ?? null);
  }
}
