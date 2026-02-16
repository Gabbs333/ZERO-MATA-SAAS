import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProductItem } from '../ProductItem';

describe('ProductItem', () => {
  const mockProduit = {
    id: '1',
    nom: 'Coca Cola',
    prix_vente: 500,
    categorie: 'boisson' as const,
    actif: true,
    stock: { quantite_disponible: 100 },
    etablissement_id: 'etab-1',
    date_creation: '2023-01-01',
  };

  const mockOnAdd = jest.fn();
  const mockOnRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders product name and price', () => {
    const { getByText } = render(
      <ProductItem
        produit={mockProduit}
        quantite={0}
        onAdd={mockOnAdd}
        onRemove={mockOnRemove}
      />
    );
    expect(getByText('Coca Cola')).toBeTruthy();
    expect(getByText('500 FCFA')).toBeTruthy();
  });

  it('displays quantity when greater than 0', () => {
    const { getByText } = render(
      <ProductItem
        produit={mockProduit}
        quantite={3}
        onAdd={mockOnAdd}
        onRemove={mockOnRemove}
      />
    );
    expect(getByText('3')).toBeTruthy();
  });

  it('calls onAdd when add button is pressed', () => {
    const { getByTestId } = render(
      <ProductItem
        produit={mockProduit}
        quantite={0}
        onAdd={mockOnAdd}
        onRemove={mockOnRemove}
      />
    );
    const addButton = getByTestId('add-button');
    fireEvent.press(addButton);
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove when remove button is pressed', () => {
    const { getByTestId } = render(
      <ProductItem
        produit={mockProduit}
        quantite={2}
        onAdd={mockOnAdd}
        onRemove={mockOnRemove}
      />
    );
    const removeButton = getByTestId('remove-button');
    fireEvent.press(removeButton);
    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('does not show remove button when quantity is 0', () => {
    const { queryByTestId } = render(
      <ProductItem
        produit={mockProduit}
        quantite={0}
        onAdd={mockOnAdd}
        onRemove={mockOnRemove}
      />
    );
    expect(queryByTestId('remove-button')).toBeNull();
  });
});
