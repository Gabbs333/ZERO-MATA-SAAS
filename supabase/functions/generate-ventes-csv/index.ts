import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface VentesRequest {
  date_debut: string;
  date_fin: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user has patron/gerant role
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['patron', 'gerant'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { date_debut, date_fin }: VentesRequest = await req.json();

    if (!date_debut || !date_fin) {
      return new Response(
        JSON.stringify({ error: 'Missing date_debut or date_fin' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch ventes data
    const { data: ventes, error } = await supabaseClient
      .from('commandes')
      .select(`
        numero_commande,
        created_at,
        date_validation,
        montant_total,
        statut,
        tables (numero),
        serveuse:profiles!commandes_serveuse_id_fkey (nom, prenom),
        validateur:profiles!commandes_validateur_id_fkey (nom, prenom),
        commande_items (
          nom_produit,
          quantite,
          prix_unitaire,
          montant_ligne
        )
      `)
      .eq('statut', 'validee')
      .gte('date_validation', date_debut)
      .lte('date_validation', date_fin)
      .order('date_validation', { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate CSV
    const csvLines: string[] = [];
    
    // Header with metadata
    csvLines.push(`# Export des Ventes`);
    csvLines.push(`# Période: ${date_debut} - ${date_fin}`);
    csvLines.push(`# Date de génération: ${new Date().toISOString()}`);
    csvLines.push('');
    
    // CSV Header
    csvLines.push('Numéro Commande,Date Création,Date Validation,Table,Serveuse,Validateur,Produit,Quantité,Prix Unitaire,Montant Ligne,Montant Total');

    // CSV Data
    for (const vente of ventes || []) {
      const table = vente.tables?.numero || 'N/A';
      const serveuse = vente.serveuse ? `${vente.serveuse.prenom} ${vente.serveuse.nom}` : 'N/A';
      const validateur = vente.validateur ? `${vente.validateur.prenom} ${vente.validateur.nom}` : 'N/A';
      
      for (const item of vente.commande_items || []) {
        csvLines.push(
          `${vente.numero_commande},${vente.created_at},${vente.date_validation},${table},${serveuse},${validateur},${item.nom_produit},${item.quantite},${item.prix_unitaire},${item.montant_ligne},${vente.montant_total}`
        );
      }
    }

    const csvContent = csvLines.join('\n');

    // Upload to storage
    const fileName = `ventes_${date_debut}_${date_fin}_${Date.now()}.csv`;
    const { error: uploadError } = await supabaseClient.storage
      .from('exports')
      .upload(fileName, csvContent, {
        contentType: 'text/csv',
        upsert: false,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: uploadError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('exports')
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        url: publicUrl,
        recordCount: ventes?.length || 0,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
