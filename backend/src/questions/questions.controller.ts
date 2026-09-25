import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Difficulty, QuestionType, RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { BulkImportQuestionsDto, CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionsService } from './questions.service';

@ApiBearerAuth()
@ApiTags('Questions')
@Controller('questions')
@Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  @Permissions('questions.manage')
  @ApiQuery({ name: 'type', enum: QuestionType, required: false })
  @ApiQuery({ name: 'difficulty', enum: Difficulty, required: false })
  @ApiQuery({ name: 'subjectId', type: String, required: false })
  @ApiQuery({ name: 'questionBankId', type: String, required: false })
  @ApiQuery({ name: 'topic', type: String, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  async findMany(
    @Query('type') type?: QuestionType,
    @Query('difficulty') difficulty?: Difficulty,
    @Query('subjectId') subjectId?: string,
    @Query('questionBankId') questionBankId?: string,
    @Query('topic') topic?: string,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const filters = { type, difficulty, subjectId, questionBankId, topic, search };
    const [questions, total] = await Promise.all([
      this.questions.findMany({ ...filters, skip: skip ? Number(skip) : undefined, take: take ? Number(take) : undefined }),
      this.questions.count(filters),
    ]);
    return { questions, total };
  }

  @Get(':id')
  @Permissions('questions.manage')
  findOne(@Param('id') id: string) {
    return this.questions.findOne(id);
  }

  @Post()
  @Permissions('questions.manage')
  create(@Body() dto: CreateQuestionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.questions.create(dto, user.sub);
  }

  @Patch(':id')
  @Permissions('questions.manage')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.questions.update(id, dto);
  }

  @Delete(':id')
  @Permissions('questions.manage')
  remove(@Param('id') id: string) {
    return this.questions.remove(id);
  }

  @Post('bulk-import')
  @Permissions('questions.manage')
  bulkImport(@Body() dto: BulkImportQuestionsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.questions.bulkImport(dto.questions, user.sub);
  }
}
