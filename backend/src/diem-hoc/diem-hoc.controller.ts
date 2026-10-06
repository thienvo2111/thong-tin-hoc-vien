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
import { DiemHocService } from './diem-hoc.service';
import {
  CreateDiemHocDto,
  QueryDiemHocDto,
  UpdateDiemHocDto,
} from './dto/diem-hoc.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// T10 (issue #2) — docs/api-contract.md mục "Điểm học". Không có DELETE
// (rule #40): ngưng bằng PATCH trang_thai.
@Controller('diem-hoc')
export class DiemHocController {
  constructor(private readonly diemHocService: DiemHocService) {}

  @Roles('quan_tri', 'so_gddt', 'phong_vhxh', 'truong')
  @Get()
  findAll(
    @Query() query: QueryDiemHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.diemHocService.findAll(query, user);
  }

  @Roles('quan_tri', 'so_gddt', 'phong_vhxh', 'truong')
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.diemHocService.findOne(id, user);
  }

  @Roles('quan_tri')
  @Post()
  create(
    @Body() dto: CreateDiemHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.diemHocService.create(dto, user);
  }

  @Roles('quan_tri')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiemHocDto,
  ) {
    return this.diemHocService.update(id, dto);
  }
}
