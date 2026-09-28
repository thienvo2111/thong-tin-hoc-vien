import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DotXacNhanService } from './dot-xac-nhan.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TaoDotXacNhanDto } from './dto/tao-dot-xac-nhan.dto';
import { SuaDotXacNhanDto } from './dto/sua-dot-xac-nhan.dto';
import { QueryDotXacNhanDto } from './dto/query-dot-xac-nhan.dto';

// Dịch vụ Đợt xác nhận — mo-rong-nls-an-giang.md mục T14. Toàn bộ CRUD chỉ
// quan_tri (tạo/gia hạn đợt là thao tác vận hành trung tâm, không theo phạm
// vi don_vi — dot_xac_nhan không thuộc về 1 đơn vị cụ thể).
@Roles('quan_tri')
@Controller('dot-xac-nhan')
export class DotXacNhanController {
  constructor(private readonly dotXacNhanService: DotXacNhanService) {}

  @Post()
  taoDot(
    @Body() dto: TaoDotXacNhanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dotXacNhanService.taoDot(dto, user.id);
  }

  @Patch(':id')
  suaDot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuaDotXacNhanDto,
  ) {
    return this.dotXacNhanService.suaDot(id, dto);
  }

  @Get()
  layDanhSach(@Query() query: QueryDotXacNhanDto) {
    return this.dotXacNhanService.layDanhSach(query);
  }
}
