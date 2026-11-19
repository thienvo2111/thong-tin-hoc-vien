import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DanhSachThamGiaService } from './danh-sach-tham-gia.service';
import { taoFileMauDanhSach } from './danh-sach-tham-gia.excel';
import { LocDanhSachDto, NapDanhSachDto } from './dto/danh-sach-tham-gia.dto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Issue #58 / ADR 0015 M3, M6, S1, S3, T7: Quản trị nạp và xem Danh sách tham gia (HSG) theo đợt.
// Endpoint riêng thay vì loại mới trong /import: bước xem trước cần chọn trường tay từng dòng (T7).
@Roles('quan_tri')
@Controller('cong-don-vi/dot-trien-khai/:id')
export class DanhSachThamGiaController {
  constructor(private readonly service: DanhSachThamGiaService) {}

  @Get('truong-trong-pham-vi')
  truongTrongPhamVi(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.truongTrongPhamVi(id);
  }

  // File mẫu giống nhau cho mọi đợt HSG (id đợt chỉ để đường dẫn nằm cùng nhóm).
  @Get('danh-sach/mau-excel')
  async mauExcel(@Res() res: Response) {
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="mau-danh-sach-tham-gia-hsg.xlsx"',
      })
      .send(await taoFileMauDanhSach());
  }

  // Chỉ đọc + khớp trường, không lưu gì.
  @Post('danh-sach/xem-truoc')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  xemTruoc(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.xemTruoc(id, file);
  }

  @Post('danh-sach/nap')
  @HttpCode(200)
  nap(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NapDanhSachDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.nap(id, dto.dong, user.id);
  }

  @Get('danh-sach')
  layDanhSach(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LocDanhSachDto,
  ) {
    return this.service.layDanhSach(id, query.don_vi_id);
  }
}
