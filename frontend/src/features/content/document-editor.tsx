'use client';

import { useState } from 'react';
import { Archive, Check, History, Loader2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  readDocumentBody,
  type ContentDocument,
  type DocumentInput,
} from '@/services/content.service';
import type { EditorAction } from './template-editor';

const MAX_LEN = 500;

/**
 * Editor for a single content document. The parent keys this by document key,
 * so selecting another document remounts it with a clean form.
 */
export function DocumentEditor({
  document,
  revisions,
  pendingAction,
  onSave,
  onPublish,
  onArchive,
  onRevert,
}: {
  document: ContentDocument;
  revisions: Array<{ id: string; version: number; note: string | null; createdAt: string }>;
  pendingAction: EditorAction;
  onSave: (input: DocumentInput) => void;
  onPublish: (note: string) => void;
  onArchive: () => void;
  onRevert: (version: number) => void;
}) {
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description ?? '');
  const [body, setBody] = useState(() => readDocumentBody(document));
  const [note, setNote] = useState('');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {document.title}
            <Badge variant={document.status === 'PUBLISHED' ? 'success' : 'secondary'}>
              {document.status}
            </Badge>
          </CardTitle>
          <p className="font-mono text-xs text-muted-foreground">
            {document.key} &middot; v{document.version}
            {document.publishedAt
              ? ` · published ${new Date(document.publishedAt).toLocaleDateString()}`
              : ' · never published'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="document-title">Title</Label>
              <Input
                id="document-title"
                value={title}
                maxLength={MAX_LEN}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="document-description">Description</Label>
              <Input
                id="document-description"
                value={description}
                maxLength={MAX_LEN}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="document-body">Body</Label>
            <Textarea
              id="document-body"
              value={body}
              rows={16}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Markdown or plain text shown on the corresponding public page."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="document-note">Change note</Label>
            <Input
              id="document-note"
              value={note}
              maxLength={MAX_LEN}
              placeholder="Recorded on the revision history when you publish"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap gap-2 pt-6">
          <Button
            onClick={() =>
              onSave({
                key: document.key,
                title,
                description: description || null,
                content: { body },
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
            onClick={() => onPublish(note)}
            disabled={pendingAction !== null || document.status === 'ARCHIVED'}
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
            className="text-destructive"
            onClick={onArchive}
            disabled={pendingAction !== null || document.status === 'ARCHIVED'}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Revision history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing published yet. A revision is recorded each time you publish.
            </p>
          ) : (
            <ul className="space-y-2">
              {revisions.map((revision) => (
                <li
                  key={revision.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">v{revision.version}</span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(revision.createdAt).toLocaleString()}
                    </span>
                    {revision.note && (
                      <p className="truncate text-muted-foreground">{revision.note}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onRevert(revision.version)}
                    disabled={pendingAction !== null}
                    title="Restore this version as a new draft"
                  >
                    {pendingAction === 'revert' ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="mr-1 h-3.5 w-3.5" />
                    )}
                    Revert
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
