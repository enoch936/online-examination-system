import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ContentService } from './content.service';

/**
 * Template and copy editing is restricted to admins. Instructors can issue
 * certificates and attach a template to their own exams, but changing the
 * wording every certificate in the product renders is a separate concern.
 */
const ADMIN_ONLY = [RoleName.SUPER_ADMIN, RoleName.ADMIN];

@ApiBearerAuth()
@ApiTags('Content')
@Controller('content')
@Roles(...ADMIN_ONLY)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  // -- Certificate templates --------------------------------------------------

  @Get('templates')
  listTemplates(@Query('includeArchived') includeArchived?: string) {
    return this.content.listTemplates(includeArchived === 'true');
  }

  @Get('templates/:idOrSlug')
  getTemplate(@Param('idOrSlug') idOrSlug: string) {
    return this.content.getTemplate(idOrSlug);
  }

  @Post('templates')
  createTemplate(@Body() body: Parameters<ContentService['createTemplate']>[0], @CurrentUser() user: AuthenticatedUser) {
    return this.content.createTemplate(body, user);
  }

  @Patch('templates/:id')
  updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Parameters<ContentService['updateTemplate']>[1],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.content.updateTemplate(id, body, user);
  }

  @Post('templates/:id/publish')
  publishTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { note?: string | null },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.content.publishTemplate(id, user, body?.note);
  }

  @Post('templates/:id/default')
  setDefaultTemplate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.content.setDefaultTemplate(id, user);
  }

  @Delete('templates/:id')
  archiveTemplate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.content.archiveTemplate(id, user);
  }

  @Get('templates/:id/revisions')
  listTemplateRevisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.content.listTemplateRevisions(id);
  }

  // -- Content documents -------------------------------------------------------

  @Get('documents')
  listDocuments() {
    return this.content.listDocuments();
  }

  @Get('documents/:key')
  getDocument(@Param('key') key: string) {
    return this.content.getDocument(key);
  }

  @Post('documents')
  createDocument(@Body() body: Parameters<ContentService['createDocument']>[0], @CurrentUser() user: AuthenticatedUser) {
    return this.content.createDocument(body, user);
  }

  @Patch('documents/:key')
  updateDocument(
    @Param('key') key: string,
    @Body() body: Parameters<ContentService['updateDocument']>[1],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.content.updateDocument(key, body, user);
  }

  @Post('documents/:key/publish')
  publishDocument(
    @Param('key') key: string,
    @Body() body: { note?: string | null },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.content.publishDocument(key, user, body?.note);
  }

  @Delete('documents/:key')
  archiveDocument(@Param('key') key: string, @CurrentUser() user: AuthenticatedUser) {
    return this.content.archiveDocument(key, user);
  }

  @Get('documents/:key/revisions')
  listDocumentRevisions(@Param('key') key: string) {
    return this.content.listDocumentRevisions(key);
  }

  @Post('documents/:key/revisions/:version/revert')
  revertDocument(
    @Param('key') key: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.content.revertDocument(key, version, user);
  }
}
