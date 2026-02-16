import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface StockRequest {
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
    const { date_debut, date_fin }: StockRequest = await req.json();

    if (!date_debut || !date_fin) {
      return new Response(
        JSON.stringify({ error: 'Missing date_debut or date_fin' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch mouvements stock data
    const { data: mouvements, error } = await supabaseClient
      .from('mouvements_stock')
      .select(`
        created_at,
        type,
        quantite,
        cout_unitaire,
        type_reference,
        produits (nom, categorie),
        utilisateur:profiles (nom, prenom)
      `)
      .gte('created_at', date_debut)
      .lte('created_at', date_fin)
      .order('created_at', { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate CSV
    const csvLines: string[] = [];
    
    // Header with metadata
    csvLines.push(`# Export des Mouvements de Stock`);
    csvLines.push(`# Période: ${date_debut} - ${date_fin}`);
    csvLines.push(`# Date de génération: ${new Date().toISOString()}`);
    csvLines.push('');
    
    // CSV Header
    csvLines.push('Date,Type Mouvement,Produit,Catégorie,Quantité,Coût Unitaire,Montant Total,Type Référence,Utilisateur');

    // CSV Data
    for (const mouvement of mouvements || []) {
      const produit = mouvement.produits?.nom || 'N/A';
      const categorie = mouvement.produits?.categorie || 'N/A';
      const utilisateur = mouvement.utilisateur ? `${mouvement.utilisateur.prenom} ${mouvement.utilisateur.nom}` : 'N/A';
      const coutUnitaire = mouvement.cout_unitaire || 0;
      const montantTotal = mouvement.quantite * coutUnitaire;
      
      csvLines.push(
        `${mouvement.created_at},${mouvement.type},${produit},${categorie},${mouvement.quantite},${coutUnitaire},${montantTotal},${mouvement.type_reference},${utilisateur}`
      );
    }

    const csvContent = csvLines.join('\n');

    // Upload to storage
    const fileName = `stock_${date_debut}_${date_fin}_${Date.now()}.csv`;
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
        recordCount: mouvements?.length || 0,
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
