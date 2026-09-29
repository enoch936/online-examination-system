'use client';

import { useState } from 'react';
import { Archive, Check, Eye, Loader2, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  TEMPLATE_PLACEHOLDERS,
  type CertificateTemplate,
  type TemplateContent,
  type TemplateDesign,
  type TemplateInput,
} from '@/services/content.service';

/** The backend rejects anything longer, so the inputs enforce the same limit. */
const MAX_LEN = 500;

/**
 * Identifies the button that is currently working. Kept as a plain string so the
 * parent can share one piece of state across both editors.
 */
export type EditorAction =
  | 'save'
  | 'publish'
  | 'preview'
  | 'default'
  | 'archive'
  | 'revert'
  | 'create'
  | null;

/**
 * Editor for a single certificate template. The parent keys this component by
 * template id, so switching templates remounts it and the form never carries
 * unsaved edits from the previously selected one.
 */
export function TemplateEditor({
  template,
  pendingAction,
  onSave,
  onPublish,
  onPreview,
  onMakeDefault,
  onArchive,
  onShowRevisions,
}: {
  template: CertificateTemplate;
  pendingAction: EditorAction;
  onSave: (input: TemplateInput) => void;
  onPublish: (note: string) => void;
  /** Receives the live, unsaved state so a preview can be rendered before saving. */
  onPreview: (state: { content: TemplateContent; design: TemplateDesign }) => void;
  onMakeDefault: () => void;
  onArchive: () => void;
  onShowRevisions: () => void;
}) {
  const [content, setContent] = useState<TemplateContent>(template.content);
  const [design, setDesignState] = useState<TemplateDesign>(template.design);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? '');
  const [note, setNote] = useState('');

  const set = <K extends keyof TemplateContent>(key: K, value: TemplateContent[K]) =>
    setContent((prev) => ({ ...prev, [key]: value }));
  const setDesign = <K extends keyof TemplateDesign>(key: K, value: TemplateDesign[K]) =>
    setDesignState((prev) => ({ ...prev, [key]: value }));

  const textFields: Array<{
    key: keyof TemplateContent;
    label: string;
    hint?: string;
    multiline?: boolean;
  }> = [
    { key: 'title', label: 'Certificate title' },
    { key: 'issuerName', label: 'Issuer name' },
    { key: 'introText', label: 'Intro text', hint: 'Appears above the recipient name.' },
    { key: 'bodyText', label: 'Body text', hint: 'Appears below the recipient name.' },
    { key: 'footerNote', label: 'Footer note', multiline: true },
    { key: 'signatoryName', label: 'Signatory name' },
    { key: 'signatoryTitle', label: 'Signatory title' },
    { key: 'sealText', label: 'Seal text', hint: 'Short circular text, e.g. your institution name.' },
  ];

  const toggles: Array<{ key: keyof TemplateContent; label: string }> = [
    { key: 'showRecipientEmail', label: 'Show recipient email' },
    { key: 'showScore', label: 'Show score' },
    { key: 'showValidity', label: 'Show validity window' },
    { key: 'showSignatory', label: 'Show signatory block' },
  ];

  /** Toggles are split because `showBorder` lives on the design layer, not content. */
  const designToggles: Array<{ key: keyof TemplateDesign; label: string }> = [
    { key: 'showBorder', label: 'Show border' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              {template.name}
              {template.isDefault && <Badge variant="success">Default</Badge>}
              <Badge variant={template.status === 'PUBLISHED' ? 'success' : 'secondary'}>
                {template.status}
              </Badge>
            </CardTitle>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {template.slug} &middot; v{template.version}
              {template.publishedAt
                ? ` · published ${new Date(template.publishedAt).toLocaleDateString()}`
                : ' · never published'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onShowRevisions}>
            Revisions
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={name}
                maxLength={MAX_LEN}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={description}
                maxLength={MAX_LEN}
                placeholder="Internal note about when to use this template"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-note">Change note</Label>
            <Input
              id="template-note"
              value={note}
              maxLength={MAX_LEN}
              placeholder="Recorded on the revision history when you publish"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wording</CardTitle>
          <p className="text-sm text-muted-foreground">
            Substitute these tokens in any wording field:{' '}
            {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
              <code
                key={placeholder}
                className="mr-1.5 rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
              >
                {'{{'}
                {placeholder}
                {'}}'}
              </code>
            ))}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {textFields.map((field) => (
            <div key={String(field.key)} className="space-y-1.5">
              <Label htmlFor={`template-${String(field.key)}`}>{field.label}</Label>
              {field.multiline ? (
                <Textarea
                  id={`template-${String(field.key)}`}
                  value={String(content[field.key] ?? '')}
                  maxLength={MAX_LEN}
                  rows={3}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              ) : (
                <Input
                  id={`template-${String(field.key)}`}
                  value={String(content[field.key] ?? '')}
                  maxLength={MAX_LEN}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              )}
              {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="template-logo">Logo URL</Label>
            <Input
              id="template-logo"
              value={content.logoUrl ?? ''}
              placeholder="https://… or an uploaded path"
              onChange={(e) => set('logoUrl', e.target.value || null)}
            />
            <p className="text-xs text-muted-foreground">
              Must be an https URL or a path within this deployment.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Design</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-accent">Accent colour</Label>
              <div className="flex gap-2">
                <Input
                  id="template-accent"
                  value={design.accentColor}
                  onChange={(e) => setDesign('accentColor', e.target.value)}
                  className="font-mono"
                />
                <input
                  type="color"
                  aria-label="Accent colour picker"
                  value={design.accentColor}
                  onChange={(e) => setDesign('accentColor', e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border bg-background p-1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-text">Text colour</Label>
              <div className="flex gap-2">
                <Input
                  id="template-text"
                  value={design.textColor}
                  onChange={(e) => setDesign('textColor', e.target.value)}
                  className="font-mono"
                />
                <input
                  type="color"
                  aria-label="Text colour picker"
                  value={design.textColor}
                  onChange={(e) => setDesign('textColor', e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border bg-background p-1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-border-width">Border width (pt)</Label>
              <Input
                id="template-border-width"
                type="number"
                min={0}
                max={12}
                value={design.borderWidth}
                onChange={(e) => setDesign('borderWidth', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-logo-width">Logo width (pt)</Label>
              <Input
                id="template-logo-width"
                type="number"
                min={40}
                max={400}
                value={design.logoWidth}
                onChange={(e) => setDesign('logoWidth', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {toggles.map((toggle) => (
              <label
                key={String(toggle.key)}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                {toggle.label}
                <Switch
                  checked={Boolean(content[toggle.key])}
                  onCheckedChange={(next) => set(toggle.key, next as TemplateContent[typeof toggle.key])}
                />
              </label>
            ))}
            {designToggles.map((toggle) => (
              <label
                key={String(toggle.key)}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                {toggle.label}
                <Switch
                  checked={Boolean(design[toggle.key])}
                  onCheckedChange={(next) =>
                    setDesign(toggle.key, next as TemplateDesign[typeof toggle.key])
                  }
                />
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap gap-2 pt-6">
          <Button
            onClick={() =>
              onSave({
                slug: template.slug,
                name,
                description: description || null,
                content,
                design,
                note: note || null,
              })
            }
            disabled={pendingAction !== null}
          >
            {pendingAction === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save draft
          </Button>
          <Button
            variant="outline"
            onClick={() => onPreview({ content, design })}
            disabled={pendingAction !== null}
            title="Render the current wording and design as a PDF with sample data. Nothing is saved."
          >
            {pendingAction === 'preview' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            Preview PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => onPublish(note)}
            disabled={pendingAction !== null || template.status === 'ARCHIVED'}
          >
            {pendingAction === 'publish' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Publish
          </Button>
          <Button
            variant="outline"
            onClick={onMakeDefault}
            disabled={pendingAction !== null || template.isDefault || template.status !== 'PUBLISHED'}
            title="Only a published template can be the default for new certificates"
          >
            {pendingAction === 'default' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Star className="mr-2 h-4 w-4" />
            )}
            Make default
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={onArchive}
            disabled={pendingAction !== null || template.isDefault || template.status === 'ARCHIVED'}
            title={
              template.isDefault
                ? 'Promote a different template to default before archiving this one'
                : 'Archive this template'
            }
          >
            {pendingAction === 'archive' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            Archive
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
