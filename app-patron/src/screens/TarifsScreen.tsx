import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { Plus, Trash2, X, Edit, RefreshCw, AlertTriangle, Tag } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const JOURS_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const JOURS_OPTIONS = [
  { label: 'Lun', val: 1 },
  { label: 'Mar', val: 2 },
  { label: 'Mer', val: 3 },
  { label: 'Jeu', val: 4 },
  { label: 'Ven', val: 5 },
  { label: 'Sam', val: 6 },
  { label: 'Dim', val: 0 },
];

interface ModeleForm {
  id: string | null;
  nom: string;
  prix_vente: string;
  jours_semaine: number[];
  heure_debut: string;
  heure_fin: string;
  date_debut: string;
  date_fin: string;
  priorite: number;
  actif: boolean;
}

const emptyModele = (): ModeleForm => ({
  id: null,
  nom: '',
  prix_vente: '',
  jours_semaine: [],
  heure_debut: '',
  heure_fin: '',
  date_debut: '',
  date_fin: '',
  priorite: 0,
  actif: true,
});

const describeConditions = (t: any): string => {
  const parts: string[] = [];

  if (t.jours_semaine && t.jours_semaine.length > 0) {
    parts.push(t.jours_semaine.map((d: number) => JOURS_LABELS[d] ?? d).join(', '));
  } else {
    parts.push('Tous les jours');
  }

  if (t.heure_debut && t.heure_fin) {
    parts.push(`${String(t.heure_debut).slice(0, 5)} → ${String(t.heure_fin).slice(0, 5)}`);
  } else {
    parts.push('Toute la journée');
  }

  if (t.date_debut || t.date_fin) {
    parts.push(`Du ${t.date_debut || '…'} au ${t.date_fin || '…'}`);
  }

  if (Number(t.priorite) !== 0) {
    parts.push(`Priorité ${t.priorite}`);
  }

  return parts.join(' • ');
};

const isoDay = (value: string) => new Date(`${value}T00:00:00`).toISOString();
const isoEndOfDay = (value: string) => new Date(`${value}T23:59:59.999`).toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

export function TarifsScreen() {
  const profile = useAuthStore((state) => state.profile);

  const [modeles, setModeles] = useState<any[]>([]);
  const [liens, setLiens] = useState<Record<string, number>>({});
  const [produits, setProduits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ModeleForm>(emptyModele());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [applyModele, setApplyModele] = useState<{ modele: any; selected: string[]; search: string } | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Recalcul rétroactif
  const [recalculDebut, setRecalculDebut] = useState(firstOfMonth());
  const [recalculFin, setRecalculFin] = useState(today());
  const [simulation, setSimulation] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isApplyingRecalcul, setIsApplyingRecalcul] = useState(false);
  const [confirmRecalcul, setConfirmRecalcul] = useState(false);

  const loadAll = async () => {
    if (!profile?.etablissement_id) return;
    setIsLoading(true);

    const [modelesRes, liensRes, produitsRes] = await Promise.all([
      supabase
        .from('tarifs_modeles')
        .select('*')
        .eq('etablissement_id', profile.etablissement_id)
        .order('nom'),
      supabase
        .from('tarifs_specifiques')
        .select('modele_id')
        .eq('etablissement_id', profile.etablissement_id)
        .not('modele_id', 'is', null),
      supabase
        .from('produits')
        .select('id, nom, categorie, prix_vente')
        .eq('etablissement_id', profile.etablissement_id)
        .order('nom'),
    ]);

    if (modelesRes.error) setError(modelesRes.error.message);
    setModeles(modelesRes.data || []);
    setProduits(produitsRes.data || []);

    const counts: Record<string, number> = {};
    (liensRes.data || []).forEach((row: any) => {
      counts[row.modele_id] = (counts[row.modele_id] || 0) + 1;
    });
    setLiens(counts);

    setIsLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.etablissement_id]);

  const openCreate = () => {
    setForm(emptyModele());
    setError(null);
    setMessage(null);
    setIsFormOpen(true);
  };

  const openEdit = (m: any) => {
    setForm({
      id: m.id,
      nom: m.nom,
      prix_vente: String(m.prix_vente),
      jours_semaine: m.jours_semaine || [],
      heure_debut: m.heure_debut ? String(m.heure_debut).slice(0, 5) : '',
      heure_fin: m.heure_fin ? String(m.heure_fin).slice(0, 5) : '',
      date_debut: m.date_debut || '',
      date_fin: m.date_fin || '',
      priorite: m.priorite ?? 0,
      actif: m.actif !== false,
    });
    setError(null);
    setMessage(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e?: any) => {
    e?.preventDefault?.();
    if (!profile?.etablissement_id) return;

    const nom = form.nom.trim();
    const prix = Number(form.prix_vente);

    if (!nom) {
      setError('Le nom est obligatoire.');
      return;
    }
    if (!Number.isFinite(prix) || prix < 0) {
      setError('Le prix doit être un nombre positif.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      etablissement_id: profile.etablissement_id,
      nom,
      prix_vente: prix,
      jours_semaine: form.jours_semaine.length > 0 ? form.jours_semaine : null,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
      priorite: Number(form.priorite) || 0,
      actif: form.actif,
      date_mise_a_jour: new Date().toISOString(),
    };

    const { error: saveError } = form.id
      ? await supabase.from('tarifs_modeles').update(payload).eq('id', form.id)
      : await supabase.from('tarifs_modeles').upsert(payload, { onConflict: 'etablissement_id,nom' });

    setIsSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setIsFormOpen(false);
    setMessage(form.id ? 'Modèle mis à jour.' : 'Modèle créé et disponible pour tous les produits.');
    await loadAll();
  };

  const handleDelete = async (m: any) => {
    if (!confirm(`Supprimer le modèle « ${m.nom} » ?\nLes règles déjà appliquées aux produits sont conservées.`)) return;
    const { error: delError } = await supabase.from('tarifs_modeles').delete().eq('id', m.id);
    if (delError) {
      setError(delError.message);
      return;
    }
    setMessage('Modèle supprimé.');
    await loadAll();
  };

  const handleApply = async () => {
    if (!applyModele) return;
    setIsApplying(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('appliquer_modele_tarif', {
        p_modele_id: applyModele.modele.id,
        p_produit_ids: applyModele.selected,
      });
      if (rpcError) throw rpcError;
      const nb = (data as any)?.produits ?? applyModele.selected.length;
      setMessage(`« ${applyModele.modele.nom} » appliqué à ${nb} produit(s).`);
      setApplyModele(null);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Application impossible.');
    } finally {
      setIsApplying(false);
    }
  };

  const runRecalcul = async (dryRun: boolean) => {
    setError(null);
    setMessage(null);
    if (!recalculDebut || !recalculFin) {
      setError('Sélectionnez une période.');
      return;
    }

    if (dryRun) setIsSimulating(true);
    else setIsApplyingRecalcul(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('recalculer_prix_ventes', {
        p_debut: isoDay(recalculDebut),
        p_fin: isoEndOfDay(recalculFin),
        p_dry_run: dryRun,
      });
      if (rpcError) throw rpcError;

      if (dryRun) {
        setSimulation(data);
      } else {
        setMessage('Recalcul appliqué. Factures, encaissements et caisse ont été réajustés.');
        setConfirmRecalcul(false);
        // On relit l'état réel : les ajustements ne doivent plus apparaître.
        const { data: after } = await supabase.rpc('recalculer_prix_ventes', {
          p_debut: isoDay(recalculDebut),
          p_fin: isoEndOfDay(recalculFin),
          p_dry_run: true,
        });
        setSimulation(after || data);
      }
    } catch (err: any) {
      setError(err?.message || 'Recalcul impossible.');
    } finally {
      setIsSimulating(false);
      setIsApplyingRecalcul(false);
    }
  };

  const filteredProduits = useMemo(() => {
    if (!applyModele) return [];
    const q = applyModele.search.trim().toLowerCase();
    if (!q) return produits;
    return produits.filter((p) => String(p.nom).toLowerCase().includes(q));
  }, [applyModele, produits]);

  const allSelected =
    filteredProduits.length > 0 && filteredProduits.every((p) => applyModele?.selected.includes(p.id));

  return (
    <div className="pb-20 md:pb-6 relative bg-neutral-50 dark:bg-dark-bg min-h-screen">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Tarifs & prix dynamiques</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Bibliothèque de tarifs réutilisables (happy hour, week-end, saisons) et recalcul des ventes passées
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            Nouveau tarif
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {(message || error) && (
          <div
            className={twMerge(
              'px-4 py-3 rounded-xl text-sm font-bold border',
              error
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
            )}
          >
            {error || message}
          </div>
        )}

        {/* Bibliothèque */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary dark:text-white flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Bibliothèque
            </h2>
            <span className="text-xs text-neutral-500">
              {modeles.length} modèle{modeles.length > 1 ? 's' : ''}
            </span>
          </div>

          {isLoading ? (
            <p className="text-sm text-neutral-400">Chargement…</p>
          ) : modeles.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-dark-card/40 border border-neutral-200 dark:border-white/5 text-center">
              <p className="text-sm text-neutral-500">
                Aucun modèle pour l'instant. Créez un tarif, puis appliquez-le à autant de produits que nécessaire.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {modeles.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl bg-white dark:bg-dark-card/40 border border-neutral-200 dark:border-white/5 shadow-soft flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-primary dark:text-white truncate">{m.nom}</span>
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-xs font-bold">
                          {formatMontant(m.prix_vente)}
                        </span>
                        {m.actif === false && (
                          <span className="px-2 py-0.5 bg-neutral-500/10 text-neutral-500 rounded text-[10px] font-bold uppercase">
                            inactif
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">{describeConditions(m)}</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {liens[m.id] ? `Appliqué à ${liens[m.id]} produit(s)` : 'Pas encore appliqué'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(m)}
                        className="p-1.5 text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(m)}
                        className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setApplyModele({ modele: m, selected: [], search: '' })}
                    className="w-full py-2 rounded-xl text-xs font-bold bg-primary/10 dark:bg-dark-accent/20 text-primary dark:text-white hover:bg-primary/20 transition-colors"
                  >
                    Appliquer à des produits…
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recalcul rétroactif */}
        <section className="p-4 md:p-6 rounded-2xl bg-white dark:bg-dark-card/40 border border-amber-500/30 shadow-soft space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold text-primary dark:text-white">Recalcul des ventes passées</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Réapplique les tarifs dynamiques actuels aux ventes déjà enregistrées. Seules les lignes où un tarif
                s'applique réellement sont modifiées. Les factures, encaissements et mouvements de caisse sont réajustés :
                un trop-perçu génère un remboursement d'ajustement.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">Du</label>
              <input
                type="date"
                value={recalculDebut}
                onChange={(e) => {
                  setRecalculDebut(e.target.value);
                  setSimulation(null);
                }}
                className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/60 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-primary dark:text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">Au</label>
              <input
                type="date"
                value={recalculFin}
                onChange={(e) => {
                  setRecalculFin(e.target.value);
                  setSimulation(null);
                }}
                className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/60 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-primary dark:text-white outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runRecalcul(true)}
              disabled={isSimulating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-neutral-200 dark:bg-white/10 text-primary dark:text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={twMerge('w-4 h-4', isSimulating && 'animate-spin')} />
              {isSimulating ? 'Simulation…' : 'Simuler (sans modifier)'}
            </button>
            <button
              onClick={() => setConfirmRecalcul(true)}
              disabled={!simulation || isApplyingRecalcul || Number(simulation?.factures_ajustees || 0) === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-amber-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Appliquer le recalcul
            </button>
          </div>

          {simulation && (
            <div className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-neutral-200 dark:divide-white/10">
                {[
                  ['Commandes', simulation.commandes],
                  ['Lignes modifiées', simulation.lignes_modifiees],
                  ['Factures ajustées', simulation.factures_ajustees],
                  ['Delta CA', formatMontant(Number(simulation.delta_ca || 0))],
                  ['Ancien CA', formatMontant(Number(simulation.ancien_ca || 0))],
                  ['Nouveau CA', formatMontant(Number(simulation.nouveau_ca || 0))],
                  ['Trop-perçu (remboursé)', formatMontant(Number(simulation.trop_percu || 0))],
                  ['Supplément facturé', formatMontant(Number(simulation.supplement || 0))],
                ].map(([label, value]) => (
                  <div key={String(label)} className="p-3">
                    <p className="text-[10px] uppercase font-bold text-neutral-400">{label}</p>
                    <p className="text-sm font-black text-primary dark:text-white">{value}</p>
                  </div>
                ))}
              </div>

              {Array.isArray(simulation.details) && simulation.details.length > 0 && (
                <div className="max-h-56 overflow-y-auto border-t border-neutral-200 dark:border-white/10">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50 dark:bg-white/5 sticky top-0">
                      <tr className="text-left text-neutral-500">
                        <th className="px-3 py-2 font-bold">Facture</th>
                        <th className="px-3 py-2 font-bold text-right">Avant</th>
                        <th className="px-3 py-2 font-bold text-right">Après</th>
                        <th className="px-3 py-2 font-bold text-right">Remb.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                      {simulation.details.map((d: any) => (
                        <tr key={d.numero_facture}>
                          <td className="px-3 py-1.5 text-primary dark:text-white">{d.numero_facture}</td>
                          <td className="px-3 py-1.5 text-right">{formatMontant(Number(d.ancien_total))}</td>
                          <td className="px-3 py-1.5 text-right font-bold">{formatMontant(Number(d.nouveau_total))}</td>
                          <td className="px-3 py-1.5 text-right text-red-500">
                            {Number(d.remboursement) > 0 ? formatMontant(Number(d.remboursement)) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Modal modèle */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-dark-card/95 rounded-2xl w-full max-w-xl shadow-2xl border border-neutral-200 dark:border-white/5 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 md:p-5 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
              <h2 className="text-lg font-bold text-primary dark:text-white font-display">
                {form.id ? 'Modifier le tarif' : 'Nouveau tarif'}
              </h2>
              <button onClick={() => setIsFormOpen(false)} className="text-neutral-400 hover:text-primary dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 md:p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Nom du tarif</label>
                  <input
                    type="text"
                    required
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    placeholder="ex: Happy Hour, Week-end, Saison haute"
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/60 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-primary dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Prix (FCFA)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={form.prix_vente}
                    onChange={(e) => setForm({ ...form, prix_vente: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/60 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-primary dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Heure début</label>
                  <input
                    type="time"
                    value={form.heure_debut}
                    onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/60 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-primary dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Heure fin</label>
                  <input
                    type="time"
                    value={form.heure_fin}
                    onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/60 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-primary dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Priorité</label>
                  <input
                    type="number"
                    value={form.priorite}
                    onChange={(e) => setForm({ ...form, priorite: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/60 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-primary dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1">Jours ciblés (vide = tous les jours)</label>
                <div className="flex flex-wrap gap-2">
                  {JOURS_OPTIONS.map((day) => {
                    const selected = form.jours_semaine.includes(day.val);
                    return (
                      <button
                        key={day.val}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            jours_semaine: selected
                              ? form.jours_semaine.filter((v) => v !== day.val)
                              : [...form.jours_semaine, day.val],
                          })
                        }
                        className={twMerge(
                          'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                          selected
                            ? 'bg-primary text-white'
                            : 'bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-neutral-300'
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Valable du (optionnel)</label>
                  <input
                    type="date"
                    value={form.date_debut}
                    onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/60 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-primary dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Valable jusqu'au</label>
                  <input
                    type="date"
                    value={form.date_fin}
                    onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/60 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-primary dark:text-white outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={form.actif}
                  onChange={(e) => setForm({ ...form, actif: e.target.checked })}
                  className="accent-primary"
                />
                Tarif actif
              </label>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-card/40 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal application */}
      {applyModele && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-white dark:bg-dark-card/95 rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-white/5 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-primary dark:text-white font-display truncate">
                  Appliquer « {applyModele.modele.nom} »
                </h2>
                <p className="text-xs text-neutral-500">
                  {formatMontant(applyModele.modele.prix_vente)} • {describeConditions(applyModele.modele)}
                </p>
              </div>
              <button onClick={() => setApplyModele(null)} className="text-neutral-400 hover:text-primary dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 flex flex-col min-h-0">
              <input
                type="text"
                value={applyModele.search}
                onChange={(e) => setApplyModele((prev) => (prev ? { ...prev, search: e.target.value } : prev))}
                placeholder="Rechercher un produit…"
                className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/60 rounded-lg text-sm text-primary dark:text-white outline-none"
              />

              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">{applyModele.selected.length} sélectionné(s)</span>
                <button
                  type="button"
                  onClick={() =>
                    setApplyModele((prev) =>
                      prev
                        ? {
                            ...prev,
                            selected: allSelected ? [] : filteredProduits.map((p) => p.id),
                          }
                        : prev
                    )
                  }
                  className="font-bold text-primary dark:text-dark-accent hover:underline"
                >
                  {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>

              <div className="overflow-y-auto divide-y divide-neutral-100 dark:divide-white/5 rounded-xl border border-neutral-200 dark:border-white/5 min-h-0">
                {filteredProduits.length === 0 ? (
                  <p className="p-3 text-xs text-neutral-400 italic">Aucun produit ne correspond.</p>
                ) : (
                  filteredProduits.map((p) => {
                    const checked = applyModele.selected.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setApplyModele((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  selected: checked
                                    ? prev.selected.filter((id) => id !== p.id)
                                    : [...prev.selected, p.id],
                                }
                              : prev
                          )
                        }
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <span className="text-sm text-primary dark:text-white truncate">
                          {p.nom}
                          <span className="ml-2 text-[10px] text-neutral-400 uppercase">{p.categorie}</span>
                          <span className="ml-2 text-[10px] text-neutral-400">{formatMontant(p.prix_vente)}</span>
                        </span>
                        <span
                          className={twMerge(
                            'w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-[10px] font-black',
                            checked
                              ? 'bg-primary dark:bg-dark-accent border-primary dark:border-dark-accent text-white'
                              : 'border-neutral-300 dark:border-white/20 text-transparent'
                          )}
                        >
                          ✓
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 dark:border-white/5 flex gap-3">
              <button
                type="button"
                onClick={() => setApplyModele(null)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-card/40 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isApplying || applyModele.selected.length === 0}
                onClick={handleApply}
                className="flex-1 px-4 py-2.5 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isApplying ? 'Application…' : `Appliquer à ${applyModele.selected.length} produit(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation recalcul */}
      {confirmRecalcul && simulation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-white dark:bg-dark-card/95 rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-white/5 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
              <div>
                <h2 className="text-lg font-bold text-primary dark:text-white">Confirmer le recalcul</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  {simulation.factures_ajustees} facture(s) seront modifiées, pour un delta de{' '}
                  <span className="font-bold">{formatMontant(Number(simulation.delta_ca || 0))}</span>.
                  {Number(simulation.trop_percu || 0) > 0 && (
                    <> Un remboursement d'ajustement de {formatMontant(Number(simulation.trop_percu))} sera enregistré en caisse.</>
                  )}
                </p>
                <p className="text-xs text-neutral-400 mt-2">Cette opération écrit dans les factures, encaissements et mouvements de caisse.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRecalcul(false)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-card/40 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => runRecalcul(false)}
                disabled={isApplyingRecalcul}
                className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isApplyingRecalcul ? 'Application…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
