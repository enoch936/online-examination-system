import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CertificateRendererService } from './certificate-renderer.service';
import { ContentService, PreviewTemplateInput } from './content.service';
import {
  assertValidTemplateContent,
  assertValidTemplateDesign,
  DEFAULT_TEMPLATE_CONTENT,
  DEFAULT_TEMPLATE_DESIGN,
} from './template-content.util';

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
  constructor(
    private readonly content: ContentService,
    private readonly renderer: CertificateRendererService,
  ) {}

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

  /**
   * Renders a certificate PDF for the template as it currently stands in the
   * editor, so wording and layout can be checked before publishing. Returns a
   * PDF rather than HTML because the issued certificate is drawn with pdfkit, and
   * a DOM mock-up would not match what students actually receive. Placeholders
   * are filled with sample values, so no real student data is involved.
   */
  // 200 rather than POST's default 201: nothing is created, and a client that
  // checks for a created resource should not be told one was.
  @Post('templates/preview')
  @HttpCode(HttpStatus.OK)
  async previewTemplate(@Body() body: PreviewTemplateInput, @Res() res: Response): Promise<void> {
    // Validated exactly as a save would be, so a template that could not be
    // saved fails here the same way rather than previewing something that will
    // be rejected on publish.
    const content = assertValidTemplateContent(body?.content ?? { ...DEFAULT_TEMPLATE_CONTENT });
    const design = assertValidTemplateDesign(body?.design ?? { ...DEFAULT_TEMPLATE_DESIGN });

    const { filename, buffer } = await this.renderer.renderPreview(content, design);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.end(buffer);
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
