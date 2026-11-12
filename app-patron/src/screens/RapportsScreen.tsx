import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, Loader2 } from 'lucide-react';

type ReportType = 'ventes' | 'produits' | 'personnel';
type PeriodType = 'jour' | 'semaine' | 'mois' | 'annee';

interface LigneJour {
  date: string;
  chiffre_affaires: number;
  encaissements: number;
  nombre_commandes: number;
  nombre_factures: number;
  impayes: number;
}

interface LigneProduit {
  produit_id: string;
  produit_nom: string;
  categorie: string;
  quantite_vendue: number;
  chiffre_affaires: number;
  nombre_commandes: number;
  prix_moyen: number;
}

interface LignePersonnel {
  utilisateur_id: string;
  nom: string;
  prenom: string;
  role: string;
  nombre_commandes?: number;
  chiffre_affaires?: number;
  montant_impayes?: number;
  nombre_impayes?: number;
  nombre_encaissements?: number;
  total_encaisse?: number;
}

const datePart = (d: Date) => format(d, 'dd/MM', { locale: fr });

export function RapportsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const navigate = useNavigate();
  const [reportType, setReportType] = useState<ReportType>('ventes');
  const [period, setPeriod] = useState<PeriodType>('mois');

  const range = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'jour':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'semaine':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'annee':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'mois':
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [period]);

  const { data, isLoading, error } = useSupabaseQuery<any>(
    ['rapports', reportType, range.start.toISOString(), range.end.toISOString(), profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: null, error: null };

      const params = {
        p_debut: range.start.toISOString(),
        p_fin: range.end.toISOString(),
      };

      if (reportType === 'ventes') {
        const { data: rows, error: err } = await supabase.rpc('get_analytics_ca_encaissements', params);
        return { data: (rows as LigneJour[]) || [], error: err };
      }

      if (reportType === 'produits') {
        const { data: rows, error: err } = await supabase.rpc('get_ventes_par_produit', params);
        return { data: (rows as LigneProduit[]) || [], error: err };
      }

      const { data: perf, error: err } = await supabase.rpc('get_performances_personnel', params);
      return { data: perf as { serveurs: LignePersonnel[]; comptoir: LignePersonnel[] }, error: err };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const totauxVentes = useMemo(() => {
    const rows = (data as LigneJour[]) || [];
    return rows.reduce(
      (acc, r) => ({
        ca: acc.ca + Number(r.chiffre_affaires || 0),
        encaisse: acc.encaisse + Number(r.encaissements || 0),
        impayes: acc.impayes + Number(r.impayes || 0),
        commandes: acc.commandes + Number(r.nombre_commandes || 0),
      }),
      { ca: 0, encaisse: 0, impayes: 0, commandes: 0 },
    );
  }, [data, reportType]);

  const totauxProduits = useMemo(() => {
    const rows = (data as LigneProduit[]) || [];
    return rows.reduce(
      (acc, r) => ({
        quantite: acc.quantite + Number(r.quantite_vendue || 0),
        ca: acc.ca + Number(r.chiffre_affaires || 0),
      }),
      { quantite: 0, ca: 0 },
    );
  }, [data, reportType]);

  return (
    <div className="pb-20 md:pb-6 min-h-screen bg-neutral-50 dark:bg-dark-bg transition-colors duration-300">
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Rapports & Analyses</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
              {format(range.start, 'dd MMM yyyy', { locale: fr })} → {format(range.end, 'dd MMM yyyy', { locale: fr })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-neutral-100 dark:bg-dark-card/60 p-1 rounded-xl">
              {(['ventes', 'produits', 'personnel'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    reportType === type
                      ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex bg-neutral-100 dark:bg-dark-card/60 p-1 rounded-xl">
              {(['jour', 'semaine', 'mois', 'annee'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    period === p
                      ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            <button
              onClick={() => navigate('/exports')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary dark:bg-dark-accent text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-sm p-3">
            {(error as any)?.message || 'Erreur de chargement du rapport.'}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary dark:text-dark-accent" />
            <p className="text-sm text-neutral-500">Chargement du rapport…</p>
          </div>
        ) : reportType === 'ventes' ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Carte label="Chiffre d'affaires" value={formatMontant(totauxVentes.ca)} />
              <Carte label="Encaissé" value={formatMontant(totauxVentes.encaisse)} tone="green" />
              <Carte label="Impayés" value={formatMontant(totauxVentes.impayes)} tone="red" />
              <Carte label="Commandes" value={String(totauxVentes.commandes)} />
            </div>

            <TableauVentes rows={(data as LigneJour[]) || []} />
          </>
        ) : reportType === 'produits' ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Carte label="Produits vendus" value={String(totauxProduits.quantite)} />
              <Carte label="Chiffre d'affaires" value={formatMontant(totauxProduits.ca)} tone="green" />
              <Carte label="Références" value={String(((data as LigneProduit[]) || []).length)} />
            </div>

            <TableauProduits rows={(data as LigneProduit[]) || []} />
          </>
        ) : (
          <TableauPersonnel data={data} />
        )}
      </div>
    </div>
  );
}

function Carte({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color =
    tone === 'green'
      ? 'text-green-600 dark:text-green-400'
      : tone === 'red'
        ? 'text-red-600 dark:text-red-400'
        : 'text-primary dark:text-white';
  return (
    <div className="rounded-2xl p-4 bg-white dark:bg-dark-card/40 border border-neutral-200 dark:border-white/5 shadow-soft">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</p>
      <p className={`text-lg font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function TableauVentes({ rows }: { rows: LigneJour[] }) {
  if (rows.length === 0) return <Vide />;
  return (
    <div className="rounded-2xl bg-white dark:bg-dark-card/40 border border-neutral-200 dark:border-white/5 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-neutral-500 border-b border-neutral-200 dark:border-white/10">
            <th className="text-left px-4 py-3">Jour</th>
            <th className="text-right px-4 py-3">CA</th>
            <th className="text-right px-4 py-3">Encaissé</th>
            <th className="text-right px-4 py-3">Impayés</th>
            <th className="text-right px-4 py-3">Commandes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
          {rows.map((r) => (
            <tr key={r.date} className="hover:bg-neutral-50 dark:hover:bg-white/5">
              <td className="px-4 py-2 font-medium text-primary dark:text-white">
                {format(parseISO(r.date), 'dd/MM/yyyy')}
              </td>
              <td className="px-4 py-2 text-right">{formatMontant(Number(r.chiffre_affaires || 0))}</td>
              <td className="px-4 py-2 text-right text-green-600">
                {formatMontant(Number(r.encaissements || 0))}
              </td>
              <td className="px-4 py-2 text-right text-red-600">{formatMontant(Number(r.impayes || 0))}</td>
              <td className="px-4 py-2 text-right">{r.nombre_commandes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableauProduits({ rows }: { rows: LigneProduit[] }) {
  if (rows.length === 0) return <Vide />;
  return (
    <div className="rounded-2xl bg-white dark:bg-dark-card/40 border border-neutral-200 dark:border-white/5 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-neutral-500 border-b border-neutral-200 dark:border-white/10">
            <th className="text-left px-4 py-3">Produit</th>
            <th className="text-left px-4 py-3">Catégorie</th>
            <th className="text-right px-4 py-3">Qté</th>
            <th className="text-right px-4 py-3">CA</th>
            <th className="text-right px-4 py-3">Commandes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
          {rows.map((r) => (
            <tr key={r.produit_id} className="hover:bg-neutral-50 dark:hover:bg-white/5">
              <td className="px-4 py-2 font-medium text-primary dark:text-white">{r.produit_nom}</td>
              <td className="px-4 py-2 text-neutral-500 uppercase text-[10px] font-bold">{r.categorie}</td>
              <td className="px-4 py-2 text-right">{r.quantite_vendue}</td>
              <td className="px-4 py-2 text-right">{formatMontant(Number(r.chiffre_affaires || 0))}</td>
              <td className="px-4 py-2 text-right">{r.nombre_commandes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableauPersonnel({ data }: { data: { serveurs?: LignePersonnel[]; comptoir?: LignePersonnel[] } | null }) {
  const serveurs = data?.serveurs || [];
  const comptoir = data?.comptoir || [];

  if (serveurs.length === 0 && comptoir.length === 0) return <Vide />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl bg-white dark:bg-dark-card/40 border border-neutral-200 dark:border-white/5 overflow-hidden">
        <p className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500 border-b border-neutral-100 dark:border-white/5">
          Serveurs / Serveuses
        </p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
            {serveurs.map((s) => (
              <tr key={s.utilisateur_id}>
                <td className="px-4 py-2 font-medium text-primary dark:text-white">
                  {s.prenom} {s.nom}
                </td>
                <td className="px-4 py-2 text-right text-neutral-500">{s.nombre_commandes ?? 0} cmd</td>
                <td className="px-4 py-2 text-right">{formatMontant(Number(s.chiffre_affaires || 0))}</td>
                <td className={`px-4 py-2 text-right ${Number(s.montant_impayes || 0) > 0 ? 'text-red-600' : 'text-neutral-400'}`}>
                  {formatMontant(Number(s.montant_impayes || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl bg-white dark:bg-dark-card/40 border border-neutral-200 dark:border-white/5 overflow-hidden">
        <p className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500 border-b border-neutral-100 dark:border-white/5">
          Comptoir
        </p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
            {comptoir.map((c) => (
              <tr key={c.utilisateur_id}>
                <td className="px-4 py-2 font-medium text-primary dark:text-white">
                  {c.prenom} {c.nom}
                </td>
                <td className="px-4 py-2 text-right text-neutral-500">{c.nombre_encaissements ?? 0} enc.</td>
                <td className="px-4 py-2 text-right">{formatMontant(Number(c.total_encaisse || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Vide() {
  return (
    <div className="rounded-2xl bg-white dark:bg-dark-card/40 border border-neutral-200 dark:border-white/5 p-12 text-center text-sm text-neutral-400">
      Aucune donnée sur la période.
    </div>
  );
}
