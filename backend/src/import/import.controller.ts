import {
  Controller,
  Get,
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
import { ImportService } from './import.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { LichSuImportQueryDto } from './dto/lich-su-import-query.dto';
import { MauExcelQueryDto } from './dto/mau-excel-query.dto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — giới hạn hợp lý tự thêm, không có trong spec

// Dịch vụ Import — docs/api-contract.md mục 5. Mọi endpoint chỉ QuảnTrị được gọi.
@Roles('quan_tri')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get('mau-excel')
  async taiMauExcel(@Query() query: MauExcelQueryDto, @Res() res: Response) {
    const { buffer, filename } = await this.importService.taiMauExcel(
      query.loai,
    );
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      .send(buffer);
  }

  @Post(':loai')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  taoImport(
    @Param('loai') loai: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importService.taoImport(loai, file, user.id);
  }

  @Get()
  lichSu(@Query() query: LichSuImportQueryDto) {
    return this.importService.lichSu(query);
  }

  @Get(':id')
  xemKetQua(@Param('id', ParseUUIDPipe) id: string) {
    return this.importService.xemKetQua(id);
  }

  @Get(':id/file-loi')
  async taiFileLoi(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.importService.taiFileLoi(id);
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      .send(buffer);
  }

  @Post(':id/xac-nhan')
  xacNhan(@Param('id', ParseUUIDPipe) id: string) {
    return this.importService.xacNhan(id);
  }
}
