import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Edge Function: Cleanup Old Exports
 * 
 * This function is designed to be called by a cron job (e.g., via cron-job.org or similar service)
 * to automatically delete export files older than 30 days from the storage bucket.
 * 
 * Recommended Schedule: Daily at 2:00 AM UTC (low traffic hours)
 * Cron Expression: 0 2 * * *
 * 
 * Security: This function uses a secret key for authentication instead of JWT
 * to allow automated execution without user authentication.
 */

Deno.serve(async (req: Request) => {
  try {
    // Verify the request is authorized using a secret key
    const authHeader = req.headers.get('Authorization');
    const expectedSecret = Deno.env.get('CLEANUP_SECRET_KEY');
    
    if (!authHeader || !expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization or secret key not configured' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract the secret from the Authorization header (format: "Bearer SECRET")
    const providedSecret = authHeader.replace('Bearer ', '');
    
    if (providedSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid secret key' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Calculate the cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    console.log(`Starting cleanup of files older than ${cutoffDate.toISOString()}`);

    // List all files in the exports bucket
    const { data: files, error: listError } = await supabaseAdmin
      .storage
      .from('exports')
      .list();

    if (listError) {
      console.error('Error listing files:', listError);
      return new Response(
        JSON.stringify({ error: listError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!files || files.length === 0) {
      console.log('No files found in exports bucket');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No files to clean up',
          filesDeleted: 0,
          cutoffDate: cutoffDate.toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter files older than 30 days
    const filesToDelete = files.filter(file => {
      const fileDate = new Date(file.created_at);
      return fileDate < cutoffDate;
    });

    console.log(`Found ${filesToDelete.length} files to delete out of ${files.length} total files`);

    if (filesToDelete.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No files older than 30 days found',
          filesDeleted: 0,
          totalFiles: files.length,
          cutoffDate: cutoffDate.toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete old files
    const fileNames = filesToDelete.map(f => f.name);
    const { data: deleteData, error: deleteError } = await supabaseAdmin
      .storage
      .from('exports')
      .remove(fileNames);

    if (deleteError) {
      console.error('Error deleting files:', deleteError);
      return new Response(
        JSON.stringify({ 
          error: deleteError.message,
          filesAttempted: fileNames.length,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully deleted ${fileNames.length} files`);

    // Log the cleanup action to audit logs (optional)
    try {
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          action: 'CLEANUP_EXPORTS',
          table_name: 'storage.objects',
          details: {
            filesDeleted: fileNames.length,
            cutoffDate: cutoffDate.toISOString(),
            fileNames: fileNames,
          },
        });
    } catch (auditError) {
      console.warn('Failed to log cleanup to audit_logs:', auditError);
      // Don't fail the cleanup if audit logging fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed successfully',
        filesDeleted: fileNames.length,
        totalFiles: files.length,
        cutoffDate: cutoffDate.toISOString(),
        deletedFiles: fileNames,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
        },
      }
    );
  } catch (error) {
    console.error('Unexpected error during cleanup:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
