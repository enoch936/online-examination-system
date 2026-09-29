'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, History, Layers, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { contentService, type TemplateContent, type TemplateDesign, type TemplateInput } from '@/services/content.service';
import { DocumentEditor } from './document-editor';
import { TemplateEditor, type EditorAction } from './template-editor';

/** Mirrors the backend slug rule so the field never posts a rejected value. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function ContentManager() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'templates' | 'documents'>('templates');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [documentKey, setDocumentKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<EditorAction>(null);
  const [showTemplateRevisions, setShowTemplateRevisions] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ['content', 'templates'],
    queryFn: () => contentService.listTemplates(true),
  });
  const documentsQuery = useQuery({
    queryKey: ['content', 'documents'],
    queryFn: () => contentService.listDocuments(),
    enabled: tab === 'documents',
  });

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);

  const selectedTemplate =
    templates.find((template) => template.id === templateId) ?? templates[0] ?? null;
  const selectedDocument =
    documents.find((document) => document.key === documentKey) ?? documents[0] ?? null;

  const templateRevisionsQuery = useQuery({
    queryKey: ['content', 'template-revisions', selectedTemplate?.id],
    queryFn: () => contentService.listTemplateRevisions(selectedTemplate!.id),
    enabled: showTemplateRevisions && !!selectedTemplate,
  });
  const documentRevisionsQuery = useQuery({
    queryKey: ['content', 'document-revisions', selectedDocument?.key],
    queryFn: () => contentService.listDocumentRevisions(selectedDocument!.key),
    enabled: tab === 'documents' && !!selectedDocument,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['content'] });
  };

  /**
   * Wraps a mutation so the toolbar can show which button is working, and every
   * failure surfaces the server's own message — content validation errors (a
   * bad hex colour, a reserved key) are only knowable server-side.
   */
  function useTrackedMutation<T>(
    action: NonNullable<EditorAction>,
    fn: (vars: T) => Promise<unknown>,
    success: string,
  ) {
    return useMutation({
      mutationFn: fn,
      onMutate: () => setPendingAction(action),
      onSettled: () => setPendingAction(null),
      onSuccess: () => {
        invalidate();
        toast.success(success);
      },
      onError: (error: Error) => toast.error(error?.message || 'Request failed'),
    });
  }

  const saveTemplate = useTrackedMutation<TemplateInput>(
    'save',
    (input) => contentService.updateTemplate(selectedTemplate!.id, input),
    'Draft saved',
  );
  const publishTemplate = useTrackedMutation<{ id: string; note: string }>(
    'publish',
    ({ id, note }) => contentService.publishTemplate(id, note || undefined),
    'Template published',
  );
  const defaultTemplate = useTrackedMutation<{ id: string }>(
    'default',
    ({ id }) => contentService.setDefaultTemplate(id),
    'Default template updated',
  );
  const archiveTemplate = useTrackedMutation<{ id: string }>(
    'archive',
    ({ id }) => contentService.archiveTemplate(id),
    'Template archived',
  );
  const createTemplate = useTrackedMutation<{ slug: string; name: string }>(
    'create',
    ({ slug, name }) => contentService.createTemplate({ slug, name }),
    'Template created',
  );

  /**
   * Renders the editor's current state and opens the PDF in a new tab.
   *
   * Deliberately not a `useTrackedMutation`: that helper invalidates the content
   * queries and toasts on success, neither of which applies to a read-only render
   * that changed nothing. The object URL is revoked once the new tab has taken
   * the blob, and the tab is only closed if the browser refused to open it.
   */
  const previewTemplate = useMutation({
    mutationFn: (state: { content: TemplateContent; design: TemplateDesign }) =>
      contentService.previewTemplate(state.content, state.design),
    onMutate: () => setPendingAction('preview'),
    onSettled: () => setPendingAction(null),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const tab = window.open(url, '_blank', 'noopener');
      if (!tab) {
        toast.error('Your browser blocked the preview tab. Allow pop-ups for this site.');
      }
      // Give the new tab time to read the blob before the URL is revoked.
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    },
    onError: (error: Error) => toast.error(error?.message || 'Preview failed'),
  });

  const saveDocument = useTrackedMutation<{ key: string; input: Parameters<typeof contentService.createDocument>[0] }>(
    'save',
    ({ key, input }) => contentService.updateDocument(key, input),
    'Draft saved',
  );
  const publishDocument = useTrackedMutation<{ key: string; note: string }>(
    'publish',
    ({ key, note }) => contentService.publishDocument(key, note || undefined),
    'Document published',
  );
  const archiveDocument = useTrackedMutation<{ key: string }>(
    'archive',
    ({ key }) => contentService.archiveDocument(key),
    'Document archived',
  );
  const revertDocument = useTrackedMutation<{ key: string; version: number }>(
    'revert',
    ({ key, version }) => contentService.revertDocument(key, version),
    'Reverted to a new draft',
  );

  return (
    <div className="space-y-6">
      <div>
        <Badge
          variant="outline"
          className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        >
          Admin
        </Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Content</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Edit the wording and design used on every certificate, and the copy behind the public pages.
          Publishing records a revision so any change can be traced and rolled back.
        </p>
      </div>

      <div className="flex rounded-md border p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setTab('templates')}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium ${
            tab === 'templates' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Certificate templates
        </button>
        <button
          type="button"
          onClick={() => setTab('documents')}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium ${
            tab === 'documents' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Content documents
        </button>
      </div>

      {tab === 'templates' ? (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Templates</CardTitle>
              <CardDescription>
                The default applies to any exam without its own template.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {templatesQuery.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setTemplateId(template.id);
                      setShowTemplateRevisions(false);
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedTemplate?.id === template.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/60'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {template.name}
                      {template.isDefault && <Badge variant="success">Default</Badge>}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {template.status} &middot; v{template.version}
                    </span>
                  </button>
                ))
              )}
              <NewItemForm
                placeholder="New template name"
                buttonLabel="Create template"
                onCreate={(name) => createTemplate.mutate({ name, slug: slugify(name) })}
                pending={createTemplate.isPending}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            {templatesQuery.error ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Failed to load templates</CardTitle>
                  <CardDescription>{(templatesQuery.error as Error).message}</CardDescription>
                </CardHeader>
              </Card>
            ) : !selectedTemplate ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Layers className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">No templates yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create one to control the wording on every certificate.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <TemplateEditor
                key={selectedTemplate.id}
                template={selectedTemplate}
                pendingAction={pendingAction}
                onSave={(input) => saveTemplate.mutate(input)}
                onPublish={(note) => publishTemplate.mutate({ id: selectedTemplate.id, note })}
                onPreview={(state) => previewTemplate.mutate(state)}
                onMakeDefault={() => defaultTemplate.mutate({ id: selectedTemplate.id })}
                onArchive={() => archiveTemplate.mutate({ id: selectedTemplate.id })}
                onShowRevisions={() => setShowTemplateRevisions((value) => !value)}
              />
            )}

            {showTemplateRevisions && selectedTemplate && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4" />
                    Template revisions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {templateRevisionsQuery.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (templateRevisionsQuery.data?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing published yet. A revision is recorded each time you publish.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {templateRevisionsQuery.data!.map((revision) => (
                        <li key={revision.id} className="rounded-lg border p-3 text-sm">
                          <span className="font-medium">v{revision.version}</span>
                          <span className="ml-2 text-muted-foreground">
                            {new Date(revision.createdAt).toLocaleString()}
                          </span>
                          {revision.note && (
                            <p className="text-muted-foreground">{revision.note}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {documentsQuery.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : (
                documents.map((document) => (
                  <button
                    key={document.key}
                    type="button"
                    onClick={() => setDocumentKey(document.key)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedDocument?.key === document.key
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/60'
                    }`}
                  >
                    <span className="text-sm font-medium">{document.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {document.key} &middot; {document.status}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <div>
            {documentsQuery.error ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Failed to load documents</CardTitle>
                  <CardDescription>{(documentsQuery.error as Error).message}</CardDescription>
                </CardHeader>
              </Card>
            ) : !selectedDocument ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">No content documents yet</p>
                </CardContent>
              </Card>
            ) : (
              <DocumentEditor
                key={selectedDocument.key}
                document={selectedDocument}
                revisions={documentRevisionsQuery.data ?? []}
                pendingAction={pendingAction}
                onSave={(input) => saveDocument.mutate({ key: selectedDocument.key, input })}
                onPublish={(note) => publishDocument.mutate({ key: selectedDocument.key, note })}
                onArchive={() => archiveDocument.mutate({ key: selectedDocument.key })}
                onRevert={(version) =>
                  revertDocument.mutate({ key: selectedDocument.key, version })
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline "create" form used by the template list. */
function NewItemForm({
  placeholder,
  buttonLabel,
  onCreate,
  pending,
}: {
  placeholder: string;
  buttonLabel: string;
  onCreate: (name: string) => void;
  pending: boolean;
}) {
  const [name, setName] = useState('');
  const valid = slugify(name).length > 0;

  return (
    <div className="space-y-2 border-t pt-3">
      <Input
        value={name}
        placeholder={placeholder}
        onChange={(event) => setName(event.target.value)}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={!valid || pending}
        onClick={() => {
          onCreate(name);
          setName('');
        }}
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        {buttonLabel}
      </Button>
    </div>
  );
}
