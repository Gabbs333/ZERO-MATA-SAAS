import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Edge Function: Cleanup Old Exports
 *
 * Purge les archives d'export arrivées à échéance (rétention 24 mois).
 * La date d'échéance est portée par `exports_journalises.date_purge_prevue`
 * (NOW() + 24 months à la génération) : aucune purge n'est faite avant.
 *
 * Recommended Schedule: Daily at 2:00 AM UTC (low traffic hours)
 * Cron Expression: 0 2 * * *
 *
 * Security: uses a secret key for authentication instead of JWT
 * to allow automated execution without user authentication.
 */

const BATCH_SIZE = 500;

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedSecret = Deno.env.get('CLEANUP_SECRET_KEY');

    if (!authHeader || !expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization or secret key not configured' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const providedSecret = authHeader.replace('Bearer ', '');

    if (providedSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid secret key' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const nowIso = new Date().toISOString();
    console.log(`Purging export archives expired before ${nowIso}`);

    const { data: expired, error: listError } = await supabaseAdmin
      .from('exports_journalises')
      .select('id, storage_path')
      .lte('date_purge_prevue', nowIso)
      .not('storage_path', 'is', null)
      .limit(BATCH_SIZE);

    if (listError) {
      console.error('Error listing expired exports:', listError);
      return new Response(
        JSON.stringify({ error: listError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const paths = (expired ?? [])
      .map((row) => row.storage_path as string | null)
      .filter((path): path is string => !!path);

    let filesDeleted = 0;

    if (paths.length > 0) {
      const { data: removed, error: removeError } = await supabaseAdmin
        .storage
        .from('exports')
        .remove(paths);

      if (removeError) {
        console.error('Error deleting files:', removeError);
        return new Response(
          JSON.stringify({ error: removeError.message, filesAttempted: paths.length }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      filesDeleted = removed?.length ?? paths.length;
      console.log(`Removed ${filesDeleted} archive file(s) from storage`);
    }

    // Supprime les lignes de journal arrivées à échéance
    const { data: rowsDeleted, error: rpcError } = await supabaseAdmin
      .rpc('cleanup_old_exports');

    if (rpcError) {
      console.error('Error purging export journal rows:', rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message, filesDeleted }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      await supabaseAdmin.from('audit_logs').insert({
        action: 'CLEANUP_EXPORTS',
        entite: 'exports_journalises',
        entite_id: 'purge',
        details_apres: {
          files_deleted: filesDeleted,
          rows_deleted: rowsDeleted ?? 0,
          cutoff: nowIso,
        },
      });
    } catch (auditError) {
      console.warn('Failed to log cleanup to audit_logs:', auditError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed',
        filesDeleted,
        rowsDeleted: rowsDeleted ?? 0,
        cutoff: nowIso,
      }),
      { headers: { 'Content-Type': 'application/json', Connection: 'keep-alive' } }
    );
  } catch (error) {
    console.error('Unexpected error during cleanup:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
