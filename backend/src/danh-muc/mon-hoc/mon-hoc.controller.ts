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
import { MonHocService } from './mon-hoc.service';
import {
  CreateMonHocDto,
  QueryMonHocDto,
  UpdateMonHocDto,
} from '../dto/mon-hoc.dto';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('danh-muc/mon-hoc')
export class MonHocController {
  constructor(private readonly monHocService: MonHocService) {}

  @Get()
  findAll(@Query() query: QueryMonHocDto) {
    return this.monHocService.findAll(query);
  }

  @Roles('quan_tri')
  @Post()
  create(@Body() dto: CreateMonHocDto) {
    return this.monHocService.create(dto);
  }

  @Roles('quan_tri')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMonHocDto) {
    return this.monHocService.update(id, dto);
  }
}
