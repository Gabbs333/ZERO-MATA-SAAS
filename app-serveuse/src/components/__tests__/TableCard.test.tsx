import React from 'react';
import { render } from '@testing-library/react-native';
import { TableCard } from '../TableCard';

describe('TableCard', () => {
  const mockTable = {
    id: '1',
    numero: 5,
    statut: 'libre' as const,
    capacite: 4,
    etablissement_id: 'etab-1',
    date_creation: '2023-01-01',
  };

  it('renders table number correctly', () => {
    const { getByText } = render(
      <TableCard table={mockTable} onPress={() => {}} />
    );
    expect(getByText('Table 5')).toBeTruthy();
  });

  it('displays correct status for libre table', () => {
    const { getByText } = render(
      <TableCard table={mockTable} onPress={() => {}} />
    );
    expect(getByText('Libre')).toBeTruthy();
  });

  it('displays correct status for occupee table', () => {
    const occupiedTable = { ...mockTable, statut: 'occupee' as const };
    const { getByText } = render(
      <TableCard table={occupiedTable} onPress={() => {}} />
    );
    expect(getByText('Occupée')).toBeTruthy();
  });

  it('displays correct status for commande_en_attente table', () => {
    const pendingTable = { ...mockTable, statut: 'commande_en_attente' as const };
    const { getByText } = render(
      <TableCard table={pendingTable} onPress={() => {}} />
    );
    expect(getByText('En attente')).toBeTruthy();
  });
});
