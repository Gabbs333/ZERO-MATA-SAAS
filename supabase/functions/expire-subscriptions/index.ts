import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Edge Function: Expire Subscriptions
 * 
 * This function is designed to be called by a cron job (e.g., via cron-job.org or similar service)
 * to automatically expire establishments whose subscription end date has passed.
 * 
 * When an establishment's subscription expires:
 * - statut_abonnement is set to 'expire'
 * - actif is set to false (disabling access)
 * - An audit log entry is created for tracking
 * 
 * Recommended Schedule: Daily at 1:00 AM UTC (low traffic hours)
 * Cron Expression: 0 1 * * *
 * 
 * Security: This function uses a secret key for authentication instead of JWT
 * to allow automated execution without user authentication.
 */

Deno.serve(async (req: Request) => {
  try {
    // Verify the request is authorized using a secret key
    const authHeader = req.headers.get('Authorization');
    const expectedSecret = Deno.env.get('EXPIRATION_SECRET_KEY');
    
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

    // Create Supabase client with service role key for admin access (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date().toISOString();
    
    console.log(`Starting subscription expiration check at ${now}`);

    // Query establishments with expired subscriptions
    // Conditions: date_fin < NOW() AND statut_abonnement = 'actif'
    const { data: expiredEstablishments, error: queryError } = await supabaseAdmin
      .from('etablissements')
      .select('id, nom, date_fin, statut_abonnement')
      .lt('date_fin', now)
      .eq('statut_abonnement', 'actif');

    if (queryError) {
      console.error('Error querying expired establishments:', queryError);
      return new Response(
        JSON.stringify({ error: queryError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!expiredEstablishments || expiredEstablishments.length === 0) {
      console.log('No expired subscriptions found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expired subscriptions found',
          expiredCount: 0,
          checkedAt: now,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredEstablishments.length} expired subscriptions`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each expired establishment
    for (const etablissement of expiredEstablishments) {
      try {
        console.log(`Expiring establishment: ${etablissement.nom} (ID: ${etablissement.id})`);

        // Update establishment status
        const { error: updateError } = await supabaseAdmin
          .from('etablissements')
          .update({
            statut_abonnement: 'expire',
            actif: false,
          })
          .eq('id', etablissement.id);

        if (updateError) {
          throw updateError;
        }

        // Create audit log entry for the expiration
        const { error: auditError } = await supabaseAdmin
          .from('audit_logs')
          .insert({
            user_id: null, // System action (no user)
            action: 'SUBSCRIPTION_EXPIRED',
            table_name: 'etablissements',
            record_id: etablissement.id,
            etablissement_id: etablissement.id,
            details: {
              nom: etablissement.nom,
              date_fin: etablissement.date_fin,
              expired_at: now,
            },
          });

        if (auditError) {
          console.warn(`Failed to create audit log for ${etablissement.id}:`, auditError);
          // Don't fail the expiration if audit logging fails
        }

        successCount++;
        results.push({
          id: etablissement.id,
          nom: etablissement.nom,
          status: 'success',
          date_fin: etablissement.date_fin,
        });

        console.log(`Successfully expired establishment: ${etablissement.nom}`);
      } catch (error) {
        errorCount++;
        console.error(`Failed to expire establishment ${etablissement.id}:`, error);
        
        results.push({
          id: etablissement.id,
          nom: etablissement.nom,
          status: 'error',
          error: error.message,
        });

        // Log the error to audit logs
        try {
          await supabaseAdmin
            .from('audit_logs')
            .insert({
              user_id: null,
              action: 'EXPIRATION_ERROR',
              table_name: 'etablissements',
              record_id: etablissement.id,
              etablissement_id: etablissement.id,
              details: {
                error: error.message,
                nom: etablissement.nom,
                date_fin: etablissement.date_fin,
              },
            });
        } catch (auditError) {
          console.warn('Failed to log expiration error to audit_logs:', auditError);
        }
      }
    }

    console.log(`Expiration process completed: ${successCount} succeeded, ${errorCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Expiration process completed',
        totalFound: expiredEstablishments.length,
        successCount,
        errorCount,
        checkedAt: now,
        results,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
        },
      }
    );
  } catch (error) {
    console.error('Unexpected error during expiration process:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
