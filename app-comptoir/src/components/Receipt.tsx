import React from 'react';
import { FactureWithDetails, Etablissement, Profile } from '../types/database.types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReceiptProps {
  facture: FactureWithDetails;
  etablissement: Etablissement | undefined | null;
  serveur: Profile | undefined | null;
}

export const Receipt = React.forwardRef<HTMLDivElement, ReceiptProps>(({ facture, etablissement, serveur }, ref) => {
  const formatPrice = (price: number) => `${price.toLocaleString('fr-FR')} FCFA`;

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'à' HH:mm", { locale: fr });
  };

  const montantRestant = facture.montant_total - facture.montant_paye;

  return (
    <div ref={ref} className="bg-white text-black p-4 max-w-[80mm] mx-auto font-mono text-xs leading-tight">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold uppercase mb-1">{etablissement?.nom || 'Restaurant'}</h1>
        {etablissement?.adresse && <p className="text-[10px]">{etablissement.adresse}</p>}
        {etablissement?.telephone && <p className="text-[10px]">Tél: {etablissement.telephone}</p>}
        {etablissement?.email && <p className="text-[10px]">{etablissement.email}</p>}
      </div>

      <div className="border-b border-black border-dashed my-2" />

      {/* Info Facture */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between">
          <span className="font-bold">Facture N°:</span>
          <span>{facture.numero_facture}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDate(facture.date_generation)}</span>
        </div>
        <div className="flex justify-between">
          <span>Table:</span>
          <span>{facture.commandes.tables?.numero || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Serveur:</span>
          <span>{serveur?.prenom} {serveur?.nom?.charAt(0)}.</span>
        </div>
      </div>

      <div className="border-b border-black border-dashed my-2" />

      {/* Items */}
      <div className="mb-2">
        <div className="flex font-bold mb-1 border-b border-black pb-1">
          <span className="w-8">Qté</span>
          <span className="flex-1">Article</span>
          <span className="text-right w-16">Total</span>
        </div>
        {facture.commandes.commande_items?.map((item, index) => (
          <div key={index} className="flex py-0.5">
            <span className="w-8">{item.quantite}</span>
            <span className="flex-1 truncate pr-1">{item.nom_produit}</span>
            <span className="text-right w-16 whitespace-nowrap">
              {(item.prix_unitaire * item.quantite).toLocaleString('fr-FR')}
            </span>
          </div>
        ))}
      </div>

      <div className="border-b border-black border-dashed my-2" />

      {/* Totals */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between font-bold text-base">
          <span>TOTAL</span>
          <span>{formatPrice(facture.montant_total)}</span>
        </div>
        
        {facture.montant_paye > 0 && (
          <div className="flex justify-between text-xs">
            <span>Payé</span>
            <span>{formatPrice(facture.montant_paye)}</span>
          </div>
        )}
        
        {montantRestant > 0 ? (
          <div className="flex justify-between font-bold mt-1">
            <span>Reste à payer</span>
            <span>{formatPrice(montantRestant)}</span>
          </div>
        ) : (
          <div className="text-center font-bold mt-2 border border-black p-1">
            FACTURE SOLDÉE
          </div>
        )}
      </div>

      <div className="border-b border-black border-dashed my-4" />

      {/* Footer */}
      <div className="text-center text-[10px]">
        <p className="font-bold mb-1">Merci de votre visite !</p>
        <p>À très bientôt.</p>
        <p className="mt-2 text-[8px] text-gray-500">Généré par ZERO MATA</p>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
