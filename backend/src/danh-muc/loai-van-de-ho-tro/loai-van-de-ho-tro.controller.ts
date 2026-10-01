import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { LoaiVanDeHoTroService } from './loai-van-de-ho-tro.service';
import {
  CreateLoaiVanDeHoTroDto,
  QueryLoaiVanDeHoTroDto,
  UpdateLoaiVanDeHoTroDto,
} from '../dto/loai-van-de-ho-tro.dto';
import { Roles } from '../../auth/decorators/roles.decorator';

// Danh mục Loại vấn đề hỗ trợ (M8) — hoc_vien đọc để chọn khi tạo ticket,
// chỉ quan_tri được sửa (xem yeu-cau-ho-tro.controller.ts cho phần ticket).
@Controller('danh-muc/loai-van-de-ho-tro')
export class LoaiVanDeHoTroController {
  constructor(private readonly service: LoaiVanDeHoTroService) {}

  @Get()
  findAll(@Query() query: QueryLoaiVanDeHoTroDto) {
    return this.service.findAll(query);
  }

  @Roles('quan_tri')
  @Post()
  create(@Body() dto: CreateLoaiVanDeHoTroDto) {
    return this.service.create(dto);
  }

  @Roles('quan_tri')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLoaiVanDeHoTroDto) {
    return this.service.update(id, dto);
  }
}
