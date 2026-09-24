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
import { DiaDanhService } from './dia-danh.service';
import {
  CreateDiaDanhDto,
  QueryDiaDanhDto,
  UpdateDiaDanhDto,
} from '../dto/dia-danh.dto';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('danh-muc/dia-danh')
export class DiaDanhController {
  constructor(private readonly diaDanhService: DiaDanhService) {}

  @Get()
  findAll(@Query() query: QueryDiaDanhDto) {
    return this.diaDanhService.findAll(query);
  }

  @Roles('quan_tri')
  @Post()
  create(@Body() dto: CreateDiaDanhDto) {
    return this.diaDanhService.create(dto);
  }

  @Roles('quan_tri')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiaDanhDto,
  ) {
    return this.diaDanhService.update(id, dto);
  }
}
