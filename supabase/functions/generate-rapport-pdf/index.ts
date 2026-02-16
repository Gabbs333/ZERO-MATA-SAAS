import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface RapportRequest {
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
    const { date_debut, date_fin }: RapportRequest = await req.json();

    if (!date_debut || !date_fin) {
      return new Response(
        JSON.stringify({ error: 'Missing date_debut or date_fin' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch analytics data using get_analytics function
    const { data: analyticsData, error: analyticsError } = await supabaseClient
      .rpc('get_analytics', {
        p_date_debut: date_debut,
        p_date_fin: date_fin,
        p_granularite: 'jour'
      });

    if (analyticsError) {
      return new Response(
        JSON.stringify({ error: analyticsError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch top products
    const { data: topProducts, error: productsError } = await supabaseClient
      .from('analytics_ventes_produits')
      .select('*')
      .order('revenu_total', { ascending: false })
      .limit(10);

    if (productsError) {
      return new Response(
        JSON.stringify({ error: productsError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate PDF content as HTML (will be converted to PDF on client side)
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Rapport de Synthèse</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #666; margin-top: 30px; }
    .metadata { color: #999; font-size: 12px; margin-bottom: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
    .kpi-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
    .kpi-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .kpi-value { font-size: 24px; font-weight: bold; color: #333; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; font-weight: bold; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <h1>Rapport de Synthèse Quotidien</h1>
  <div class="metadata">
    <p>Période: ${date_debut} - ${date_fin}</p>
    <p>Date de génération: ${new Date().toLocaleString('fr-FR')}</p>
  </div>

  <h2>Indicateurs Clés de Performance (KPIs)</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Chiffre d'Affaires</div>
      <div class="kpi-value">${analyticsData.kpis.chiffre_affaires.toLocaleString('fr-FR')} FCFA</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Bénéfice</div>
      <div class="kpi-value">${analyticsData.kpis.benefice.toLocaleString('fr-FR')} FCFA</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Nombre de Commandes</div>
      <div class="kpi-value">${analyticsData.kpis.nombre_commandes}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Panier Moyen</div>
      <div class="kpi-value">${analyticsData.kpis.panier_moyen.toLocaleString('fr-FR')} FCFA</div>
    </div>
  </div>

  <h2>Top 10 Produits</h2>
  <table>
    <thead>
      <tr>
        <th>Produit</th>
        <th>Catégorie</th>
        <th>Quantité Vendue</th>
        <th>Revenu Total</th>
      </tr>
    </thead>
    <tbody>
      ${topProducts?.map(p => `
        <tr>
          <td>${p.nom_produit}</td>
          <td>${p.categorie}</td>
          <td>${p.quantite_vendue}</td>
          <td>${parseInt(p.revenu_total).toLocaleString('fr-FR')} FCFA</td>
        </tr>
      `).join('') || '<tr><td colspan="4">Aucune donnée</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <p>Rapport généré automatiquement par le Système de Gestion de Snack-Bar</p>
  </div>
</body>
</html>
    `;

    // For now, we'll store the HTML content
    // In a real implementation, you would use a PDF generation library
    // or convert HTML to PDF using a service like Puppeteer
    const fileName = `rapport_${date_debut}_${date_fin}_${Date.now()}.html`;
    const { error: uploadError } = await supabaseClient.storage
      .from('exports')
      .upload(fileName, htmlContent, {
        contentType: 'text/html',
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
        note: 'HTML report generated. Convert to PDF on client side using jsPDF or similar library.',
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
