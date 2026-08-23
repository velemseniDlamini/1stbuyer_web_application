// Finance pack reads and writes against public.documents.
//
// WHAT IS STORED, AND WHAT IS NOT.
//
// The row holds a file NAME and the date the user says is printed on the
// document. The file itself is never uploaded, never read and never verified.
// That was true when this lived in localStorage and it is still true now that
// it lives in Postgres: moving a filename to a server does not make it a
// document store, and the screen says so.
//
// The pack definition (which items exist, their currency rules) stays in
// lib/documents.ts. This module only records which of them the user has.

import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_DOCS, type DocItem } from './documents'

export type DocumentRow = {
  id: string
  doc_key: string
  file_name: string
  doc_date: string | null
  status: 'missing' | 'added'
  created_at: string
}

/**
 * Merge stored rows onto the current pack definition, so a pack item added
 * after the user's last visit still appears, and a stored row for an item that
 * no longer exists is ignored rather than rendered as an orphan.
 */
export function rowsToDocuments(rows: readonly DocumentRow[]): DocItem[] {
  return DEFAULT_DOCS.map((def) => {
    const row = rows.find((r) => r.doc_key === def.id)
    if (!row || row.status !== 'added') return def
    return {
      ...def,
      fileName: row.file_name,
      status: 'added' as const,
      addedAt: row.created_at,
      docDate: row.doc_date ?? undefined,
    }
  })
}

export type DocumentsFetch =
  | { ok: true; documents: DocItem[] }
  | { ok: false; error: string }

export async function fetchDocuments(client: SupabaseClient): Promise<DocumentsFetch> {
  const { data, error } = await client
    .from('documents')
    .select('id, doc_key, file_name, doc_date, status, created_at')

  if (error) return { ok: false, error: 'We could not load your finance pack.' }
  return { ok: true, documents: rowsToDocuments(data as DocumentRow[]) }
}

export type WriteResult = { ok: true } | { ok: false; error: string }

export async function upsertDocument(
  client: SupabaseClient,
  userId: string,
  docKey: string,
  fileName: string,
  docDate?: string,
): Promise<WriteResult> {
  const { error } = await client.from('documents').upsert(
    {
      profile_id: userId,
      doc_key: docKey,
      file_name: fileName,
      doc_date: docDate || null,
      status: 'added',
    },
    { onConflict: 'profile_id,doc_key' },
  )

  return error
    ? { ok: false, error: 'We could not record that document. Try again.' }
    : { ok: true }
}

export async function deleteDocument(
  client: SupabaseClient,
  userId: string,
  docKey: string,
): Promise<WriteResult> {
  const { error } = await client
    .from('documents')
    .delete()
    .eq('profile_id', userId)
    .eq('doc_key', docKey)

  return error
    ? { ok: false, error: 'We could not remove that document. Try again.' }
    : { ok: true }
}
