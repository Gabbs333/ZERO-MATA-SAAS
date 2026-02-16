# Composants UI Réutilisables - Système de Gestion de Snack-Bar

## Introduction

Ce document catalogue tous les composants UI réutilisables extraits des **15 maquettes HTML** fournies. Il sert de référence pour l'implémentation des trois applications clientes :
- Application Mobile Serveuse (React Native)
- Application Web Comptoir (React)
- Application Web Tableau de Bord Patron (React)

## Maquettes Analysées

Les **18 maquettes HTML** analysées couvrent les écrans suivants :

### Application Manager/Gérant
1. **Manager Dashboard Overview** (Light) - Vue d'ensemble avec KPIs, graphiques et validations en attente
2. **Stock Inventory & History** (Dark) - Gestion du stock avec liste des produits et alertes
3. **User & Roles Management** (Light) - Gestion des utilisateurs et des rôles avec badges de rôle colorés
4. **Record New Supply Arrival** (Light) - Formulaire d'enregistrement de ravitaillement avec items multiples

### Application Patron/Owner
5. **Financial Performance Dashboard** (Dark) - Tableau de bord financier avec graphiques et KPIs
6. **Financial Performance Dashboard** (Light) - Version claire du tableau de bord financier
7. **Profit & Loss Reports** (Light) - Rapports de rentabilité par produit avec classement
8. **Outstanding Debts Tracking** (Dark) - Suivi des factures impayées avec alertes d'ancienneté

### Application Comptoir/Counter
9. **Payment Entry** (Dark Industrial) - Écran d'enregistrement des paiements avec méthodes multiples et style ticket
10. **Counter Order Validation** (Light Professional) - Validation des commandes en attente avec cartes détaillées

### Application Serveuse/Waitress
11. **Table Management Grid** (Dark) - Grille des tables avec statuts visuels (libre, occupée, en attente)
12. **New Order Entry** (Dark) - Écran de prise de commande avec catalogue produits et panier flottant

### Application Commune/Shared
13. **Product Details Editor** (Dark) - Formulaire d'ajout/modification de produit avec upload d'image
14. **Stock Supply History Detail** (Dark) - Historique détaillé des ravitaillements avec accordéons
15. **System Activity Audit Log** (Dark) - Journal d'audit des actions système
16. **User Profile & Settings** (Dark) - Profil utilisateur et paramètres
17. **Product Catalog List** (Dark) - Liste des produits avec toggle actif/inactif
18. **Record New Supply Arrival** (Light) - Autre version du formulaire de ravitaillement

**Note** : Les maquettes utilisent **Tailwind CSS** pour le styling et **Material Symbols Outlined** pour les icônes. Chaque maquette a son propre thème de couleurs adapté à son contexte d'utilisation.

## Système de Design

### Palettes de Couleurs Extraites des Maquettes

Les maquettes utilisent plusieurs thèmes cohérents selon l'application :

#### Thème Manager Dashboard (Light Mode)
```typescript
const managerLightTheme = {
  primary: '#141414',           // Noir principal
  backgroundLight: '#f7f7f7',   // Fond clair
  backgroundDark: '#191919',    // Fond sombre
  semanticGreen: '#039855',     // Vert succès
  semanticRed: '#D92D20',       // Rouge erreur
  semanticAmber: '#DC6803',     // Orange avertissement
  
  // Utilisé pour les cartes et surfaces
  surface: '#ffffff',
  border: '#e5e5e5'
}
```

#### Thème Stock Inventory (Dark Mode)
```typescript
const stockDarkTheme = {
  primary: '#2c576d',           // Bleu-gris principal
  primaryDark: '#1f3e4f',       // Bleu-gris foncé
  accent: '#D39E3B',            // Or/Ambre accent
  backgroundLight: '#f6f7f7',   // Fond clair
  backgroundDark: '#161519',    // Fond très sombre
  surfaceDark: '#2A2A2E',       // Surface sombre
  borderDark: '#3f515a',        // Bordure sombre
}
```

#### Thème Financial Dashboard (Dark/Light)
```typescript
const financialTheme = {
  navy: '#0f172a',              // Bleu marine principal
  navyLight: '#334155',         // Bleu marine clair
  primary: '#1e3a8a',           // Bleu primaire
  primaryLight: '#3b82f6',      // Bleu primaire clair
  success: '#10b981',           // Vert succès
  warning: '#f59e0b',           // Orange avertissement
  danger: '#ef4444',            // Rouge danger
  
  // Light mode
  backgroundLight: '#f8fafc',
  cardLight: '#ffffff',
  borderLight: '#e2e8f0',
  
  // Dark mode
  backgroundDark: '#020617',
  cardDark: '#0f172a',
  borderDark: '#1e293b',
  
  // Chart colors
  chartCyan: '#22d3ee',
  chartEmerald: '#34d399',
}
```

#### Thème Payment Entry (Dark Industrial)
```typescript
const paymentDarkTheme = {
  primary: '#0d6273',           // Bleu-vert principal
  primaryLight: '#1a8a9f',      // Bleu-vert clair
  accentGold: '#D4AF37',        // Or accent
  backgroundDark: '#0E1112',    // Fond très sombre
  surfaceDark: '#1F2427',       // Surface sombre
  borderDark: '#3f515a',        // Bordure sombre
  textMuted: '#9EA8AC',         // Texte atténué
  textLight: '#E0E5E7',         // Texte clair
}
```

#### Thème Counter Validation (Light Professional)
```typescript
const counterLightTheme = {
  primary: '#19304d',           // Bleu marine professionnel
  secondary: '#5c708a',         // Gris-bleu secondaire
  danger: '#D9534F',            // Rouge danger
  warning: '#f59e0b',           // Orange avertissement
  backgroundLight: '#f2f4f7',   // Fond gris clair
  surfaceLight: '#ffffff',      // Surface blanche
  
  // Shadows
  cardShadow: '0 2px 8px -1px rgba(25, 48, 77, 0.08)',
  floatShadow: '0 10px 30px -5px rgba(25, 48, 77, 0.15)',
}
```

#### Thème User Management (Light/Dark)
```typescript
const userManagementTheme = {
  primary: '#00476b',           // Bleu foncé
  backgroundLight: '#f9fafb',   // Fond très clair
  backgroundDark: '#1a1a1a',    // Fond sombre
  surfaceLight: '#ffffff',
  surfaceDark: '#2a2a2a',
  
  // Role colors
  roleManager: '#D4AF37',       // Or pour Manager
  roleWaitress: '#3399FF',      // Bleu pour Serveuse
  roleCounter: '#7A33FF',       // Violet pour Comptoir
  rolePatron: '#28A745',        // Vert pour Patron
}
```

#### Thème Product Editor (Dark)
```typescript
const productEditorTheme = {
  primary: '#0d6273',           // Bleu-vert principal
  backgroundLight: '#f9fafa',   // Fond clair
  backgroundDark: '#121416',    // Fond très sombre
  surfaceDark: '#1F2427',       // Surface sombre
  textMuted: '#9EA8AC',         // Texte atténué
  textLight: '#E0E5E7',         // Texte clair
}
```

#### Thème Supply History (Dark)
```typescript
const supplyHistoryTheme = {
  primary: '#1d8ea5',           // Bleu-vert principal
  primaryDark: '#156a7b',       // Bleu-vert foncé
  backgroundLight: '#f6f8f8',   // Fond clair
  backgroundDark: '#121e20',    // Fond sombre
  surfaceDark: '#1A2628',       // Surface sombre
  surfaceLight: '#ffffff',
}
```

#### Thème Table Management (Dark)
```typescript
const tableManagementTheme = {
  appBg: '#121212',             // Fond app (charcoal profond)
  appCard: '#1E1E1E',           // Carte (gris légèrement plus clair)
  appBorder: '#2A2A2A',         // Bordure subtile
  
  // Status colors (accessible pour dark mode)
  statusFreeText: '#6EE7B7',    // Emerald 300 (libre)
  statusFreeBg: 'rgba(16, 185, 129, 0.15)',
  statusFreeBorder: 'rgba(16, 185, 129, 0.3)',
  
  statusPendingText: '#FCD34D', // Amber 300 (en attente)
  statusPendingBg: 'rgba(245, 158, 11, 0.15)',
  statusPendingBorder: 'rgba(245, 158, 11, 0.3)',
  
  statusOccupiedText: '#93C5FD', // Blue 300 (occupée)
  statusOccupiedBg: 'rgba(59, 130, 246, 0.15)',
  statusOccupiedBorder: 'rgba(59, 130, 246, 0.3)',
}
```

#### Thème Order Entry (Dark)
```typescript
const orderEntryTheme = {
  primary: '#141414',           // Noir principal
  secondary: '#e5e5e5',         // Gris clair secondaire
  backgroundLight: '#f7f7f7',   // Fond clair
  backgroundDark: '#191919',    // Fond sombre
  
  // Alert colors
  alertCritical: '#ef4444',     // Rouge critique
  alertWarning: '#f59e0b',      // Orange avertissement
  alertSuccess: '#10b981',      // Vert succès
}
```

#### Thème Profit & Loss (Light)
```typescript
const profitLossTheme = {
  primary: '#1776ba',           // Bleu principal
  primaryDark: '#105a8f',       // Bleu foncé
  backgroundLight: '#f0f2f4',   // Fond gris clair
  backgroundDark: '#1a1d23',    // Fond sombre
  cardLight: '#ffffff',
  cardDark: '#252a33',
  borderLight: '#e2e8f0',
  borderDark: '#343b45',
  success: '#10b981',
  danger: '#ef4444',
}
```

#### Thème Outstanding Debts (Dark)
```typescript
const outstandingDebtsTheme = {
  primary: '#1d8ea5',           // Bleu-vert principal
  primaryDark: '#156a7b',       // Bleu-vert foncé
  backgroundLight: '#f7f7f8',   // Fond clair
  backgroundDark: '#16181d',    // Fond sombre
  surfaceDark: '#292d34',       // Surface sombre
  surfaceBorder: '#3a404a',     // Bordure surface
  textPrimary: '#e3e6eb',       // Texte principal
  textSecondary: '#959aa3',     // Texte secondaire
  alert: '#e1a14d',             // Alerte orange
}
```

#### Thème Product Catalog (Dark)
```typescript
const productCatalogTheme = {
  primary: '#1b4498',           // Bleu principal
  backgroundLight: '#fafafa',   // Fond très clair
  backgroundDark: '#18181b',    // Fond sombre (zinc-900)
}
```

### Typographie Extraite des Maquettes

Les maquettes utilisent plusieurs familles de polices selon le contexte :

```typescript
const typography = {
  fontFamily: {
    // Manager Dashboard
    managerDisplay: "'Plus Jakarta Sans', sans-serif",
    managerBody: "'Noto Sans', sans-serif",
    
    // Stock Inventory
    stockDisplay: "'Space Grotesk', sans-serif",
    stockBody: "'Noto Sans', sans-serif",
    
    // Financial & User Management
    financialDisplay: "'Manrope', sans-serif",
    
    // Counter Validation
    counterDisplay: "'Work Sans', sans-serif",
    
    // Monospace pour les montants
    monospace: "'Roboto Mono', 'Courier New', monospace"
  },
  
  fontSize: {
    xs: '0.625rem',   // 10px - Labels, badges
    sm: '0.75rem',    // 12px - Texte secondaire
    base: '0.875rem', // 14px - Texte principal
    md: '1rem',       // 16px - Titres secondaires
    lg: '1.125rem',   // 18px - Titres
    xl: '1.25rem',    // 20px - Grands titres
    '2xl': '1.5rem',  // 24px - Titres principaux
    '3xl': '2rem',    // 32px - Montants importants
    '4xl': '2.5rem'   // 40px - Montants très importants
  },
  
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800
  },
  
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75
  },
  
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em'
  }
}
```

### Spacing

```typescript
const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem'    // 64px
}
```

### Bordures et Ombres

```typescript
const borders = {
  radius: {
    none: '0',
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px'   // Cercle complet
  },
  
  width: {
    thin: '1px',
    medium: '2px',
    thick: '4px'
  }
}

const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
}
```

## Composants de Base (Atoms)

### Button

Bouton réutilisable avec différentes variantes.

**Props:**
```typescript
interface ButtonProps {
  variant: 'contained' | 'outlined' | 'text'
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  size: 'small' | 'medium' | 'large'
  disabled?: boolean
  fullWidth?: boolean
  startIcon?: ReactNode
  endIcon?: ReactNode
  onClick?: () => void
  children: ReactNode
}
```

**Variantes:**
- **Contained**: Bouton plein avec fond coloré
- **Outlined**: Bouton avec bordure, fond transparent
- **Text**: Bouton texte sans bordure

**Utilisation:**
```tsx
<Button variant="contained" color="primary" size="medium">
  Valider
</Button>

<Button variant="outlined" color="error" startIcon={<DeleteIcon />}>
  Supprimer
</Button>
```

### Input / TextField

Champ de saisie de texte avec label et validation.

**Props:**
```typescript
interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'email' | 'password' | 'tel'
  placeholder?: string
  error?: boolean
  helperText?: string
  disabled?: boolean
  required?: boolean
  fullWidth?: boolean
  multiline?: boolean
  rows?: number
  startAdornment?: ReactNode
  endAdornment?: ReactNode
}
```

**Utilisation:**
```tsx
<TextField
  label="Nom du produit"
  value={nom}
  onChange={setNom}
  required
  fullWidth
  error={!!errors.nom}
  helperText={errors.nom}
/>
```

### Badge

Indicateur visuel pour afficher un statut ou un compteur.

**Props:**
```typescript
interface BadgeProps {
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  variant: 'standard' | 'dot'
  content?: string | number
  max?: number
  invisible?: boolean
  children: ReactNode
}
```

**Utilisation:**
```tsx
<Badge color="error" content={5}>
  <NotificationIcon />
</Badge>

<Badge color="success" variant="dot">
  <StatusIcon />
</Badge>
```

### Chip

Élément compact pour afficher des tags, statuts ou filtres.

**Props:**
```typescript
interface ChipProps {
  label: string
  color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  variant: 'filled' | 'outlined'
  size: 'small' | 'medium'
  icon?: ReactNode
  onDelete?: () => void
  onClick?: () => void
}
```

**Utilisation:**
```tsx
<Chip label="En attente" color="warning" variant="filled" />
<Chip label="Validée" color="success" icon={<CheckIcon />} />
<Chip label="Boisson" variant="outlined" onDelete={handleDelete} />
```

### Avatar

Image circulaire pour représenter un utilisateur.

**Props:**
```typescript
interface AvatarProps {
  src?: string
  alt: string
  size: 'small' | 'medium' | 'large'
  fallback?: string  // Initiales si pas d'image
  color?: string
}
```

### IconButton

Bouton circulaire contenant uniquement une icône.

**Props:**
```typescript
interface IconButtonProps {
  icon: ReactNode
  color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  size: 'small' | 'medium' | 'large'
  disabled?: boolean
  onClick?: () => void
}
```

### Switch / Toggle

Interrupteur pour activer/désactiver une option.

**Props:**
```typescript
interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  color: 'primary' | 'secondary' | 'success'
}
```

## Composants de Mise en Page (Layout)

### Card

Conteneur avec ombre pour regrouper du contenu.

**Props:**
```typescript
interface CardProps {
  elevation?: 0 | 1 | 2 | 3 | 4
  variant?: 'elevation' | 'outlined'
  children: ReactNode
}
```

**Sous-composants:**
- **CardHeader**: En-tête avec titre et actions
- **CardContent**: Contenu principal
- **CardActions**: Zone d'actions (boutons)

**Utilisation:**
```tsx
<Card elevation={2}>
  <CardHeader
    title="Commande #CMD-20240115-001"
    subtitle="Table 5 - Marie Dupont"
    action={<IconButton icon={<MoreIcon />} />}
  />
  <CardContent>
    {/* Contenu */}
  </CardContent>
  <CardActions>
    <Button variant="outlined">Annuler</Button>
    <Button variant="contained">Valider</Button>
  </CardActions>
</Card>
```

### AppBar / NavigationBar

Barre de navigation en haut de l'écran.

**Props:**
```typescript
interface AppBarProps {
  title: string
  position?: 'fixed' | 'sticky' | 'static'
  color?: 'primary' | 'secondary' | 'transparent'
  leftAction?: ReactNode
  rightActions?: ReactNode[]
}
```

**Utilisation:**
```tsx
<AppBar
  title="Gestion des Commandes"
  leftAction={<IconButton icon={<MenuIcon />} />}
  rightActions={[
    <IconButton icon={<NotificationIcon />} />,
    <Avatar src={user.avatar} />
  ]}
/>
```

### BottomNavigation (Mobile)

Barre de navigation en bas pour mobile.

**Props:**
```typescript
interface BottomNavigationProps {
  value: string
  onChange: (value: string) => void
  items: Array<{
    value: string
    label: string
    icon: ReactNode
    badge?: number
  }>
}
```

**Utilisation:**
```tsx
<BottomNavigation value={activeTab} onChange={setActiveTab}>
  <BottomNavigationItem
    value="tables"
    label="Tables"
    icon={<TableIcon />}
  />
  <BottomNavigationItem
    value="commandes"
    label="Commandes"
    icon={<OrderIcon />}
    badge={3}
  />
</BottomNavigation>
```

### Drawer / Sidebar

Menu latéral coulissant.

**Props:**
```typescript
interface DrawerProps {
  open: boolean
  onClose: () => void
  anchor: 'left' | 'right'
  variant: 'temporary' | 'permanent' | 'persistent'
  children: ReactNode
}
```

### Grid / Container

Système de grille responsive.

**Props:**
```typescript
interface GridProps {
  container?: boolean
  item?: boolean
  xs?: number  // 1-12
  sm?: number
  md?: number
  lg?: number
  xl?: number
  spacing?: number
  children: ReactNode
}
```

**Utilisation:**
```tsx
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>
    <Card>Contenu 1</Card>
  </Grid>
  <Grid item xs={12} md={6}>
    <Card>Contenu 2</Card>
  </Grid>
</Grid>
```

## Composants de Feedback

### Alert / Notification

Message d'alerte ou de notification.

**Props:**
```typescript
interface AlertProps {
  severity: 'success' | 'info' | 'warning' | 'error'
  variant: 'filled' | 'outlined' | 'standard'
  title?: string
  message: string
  onClose?: () => void
  action?: ReactNode
}
```

**Utilisation:**
```tsx
<Alert severity="success" title="Succès" onClose={handleClose}>
  La commande a été validée avec succès
</Alert>

<Alert severity="error" variant="filled">
  Stock insuffisant pour ce produit
</Alert>
```

### Snackbar / Toast

Notification temporaire en bas de l'écran.

**Props:**
```typescript
interface SnackbarProps {
  open: boolean
  message: string
  severity?: 'success' | 'info' | 'warning' | 'error'
  duration?: number  // ms
  onClose: () => void
  action?: ReactNode
}
```

### Dialog / Modal

Fenêtre modale pour afficher du contenu par-dessus l'interface.

**Props:**
```typescript
interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  fullScreen?: boolean
  children: ReactNode
  actions?: ReactNode
}
```

**Utilisation:**
```tsx
<Dialog
  open={isOpen}
  onClose={handleClose}
  title="Confirmer la validation"
  maxWidth="sm"
>
  <DialogContent>
    Êtes-vous sûr de vouloir valider cette commande ?
  </DialogContent>
  <DialogActions>
    <Button variant="outlined" onClick={handleClose}>
      Annuler
    </Button>
    <Button variant="contained" onClick={handleConfirm}>
      Confirmer
    </Button>
  </DialogActions>
</Dialog>
```

### Loading / Spinner

Indicateur de chargement.

**Props:**
```typescript
interface LoadingProps {
  size?: 'small' | 'medium' | 'large'
  color?: 'primary' | 'secondary'
  variant?: 'circular' | 'linear'
  value?: number  // Pour linear (0-100)
}
```

### Skeleton

Placeholder animé pendant le chargement.

**Props:**
```typescript
interface SkeletonProps {
  variant: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | false
}
```

## Composants de Données

### Table / DataGrid

Tableau de données avec tri, filtrage et pagination.

**Props:**
```typescript
interface TableProps {
  columns: Array<{
    field: string
    headerName: string
    width?: number
    sortable?: boolean
    filterable?: boolean
    renderCell?: (row: any) => ReactNode
  }>
  rows: any[]
  loading?: boolean
  pagination?: boolean
  pageSize?: number
  onRowClick?: (row: any) => void
  selectable?: boolean
  selectedRows?: any[]
  onSelectionChange?: (rows: any[]) => void
}
```

**Utilisation:**
```tsx
<Table
  columns={[
    { field: 'numero', headerName: 'N° Commande', width: 150 },
    { field: 'table', headerName: 'Table', width: 100 },
    { field: 'montant', headerName: 'Montant', width: 120,
      renderCell: (row) => `${row.montant} FCFA` },
    { field: 'statut', headerName: 'Statut', width: 120,
      renderCell: (row) => <StatusChip status={row.statut} /> }
  ]}
  rows={commandes}
  pagination
  pageSize={50}
  onRowClick={handleRowClick}
/>
```

### List / ListView

Liste d'éléments avec support du scroll infini.

**Props:**
```typescript
interface ListProps {
  items: any[]
  renderItem: (item: any, index: number) => ReactNode
  keyExtractor: (item: any) => string
  loading?: boolean
  onEndReached?: () => void
  emptyMessage?: string
  divider?: boolean
}
```

### Accordion / Collapsible

Panneau extensible pour afficher/masquer du contenu.

**Props:**
```typescript
interface AccordionProps {
  title: string
  subtitle?: string
  expanded?: boolean
  onChange?: (expanded: boolean) => void
  children: ReactNode
}
```

## Composants Métier (Business)

### ProductCard

Carte produit pour l'interface de commande.

**Props:**
```typescript
interface ProductCardProps {
  product: {
    id: string
    nom: string
    categorie: string
    prixVente: number
    stockDisponible: number
    image?: string
  }
  quantity?: number
  onAdd?: () => void
  onRemove?: () => void
  disabled?: boolean
}
```

**Utilisation:**
```tsx
<ProductCard
  product={produit}
  quantity={panier[produit.id] || 0}
  onAdd={() => handleAddToCart(produit.id)}
  onRemove={() => handleRemoveFromCart(produit.id)}
  disabled={produit.stockDisponible === 0}
/>
```

### OrderCard

Carte commande pour la liste des commandes.

**Props:**
```typescript
interface OrderCardProps {
  order: {
    id: string
    numeroCommande: string
    table: { numero: string }
    serveuse: { nom: string, prenom: string }
    items: Array<{ produit: string, quantite: number, prix: number }>
    montantTotal: number
    statut: 'en_attente' | 'validee' | 'annulee'
    dateCreation: Date
  }
  onValidate?: () => void
  onReject?: () => void
  onClick?: () => void
}
```

### TableCard

Carte table pour la gestion des tables.

**Props:**
```typescript
interface TableCardProps {
  table: {
    id: string
    numero: string
    statut: 'libre' | 'occupee' | 'commande_en_attente'
    derniereMiseAJour: Date
  }
  onClick?: () => void
  onFree?: () => void
}
```

**Utilisation:**
```tsx
<TableCard
  table={table}
  onClick={() => handleSelectTable(table.id)}
  onFree={() => handleFreeTable(table.id)}
/>
```

### InvoiceCard

Carte facture pour la gestion des factures.

**Props:**
```typescript
interface InvoiceCardProps {
  invoice: {
    id: string
    numeroFacture: string
    commande: { numeroCommande: string }
    montantTotal: number
    montantPaye: number
    montantRestant: number
    statut: 'en_attente_paiement' | 'partiellement_payee' | 'payee'
    dateGeneration: Date
  }
  onPay?: () => void
  onPrint?: () => void
}
```

### StockAlertCard

Carte alerte de stock bas.

**Props:**
```typescript
interface StockAlertCardProps {
  alert: {
    produit: { nom: string, categorie: string }
    quantiteDisponible: number
    seuilMinimum: number
  }
  onRestock?: () => void
}
```

### KPICard

Carte indicateur clé de performance.

**Props:**
```typescript
interface KPICardProps {
  title: string
  value: string | number
  unit?: string
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  icon?: ReactNode
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
}
```

**Utilisation:**
```tsx
<KPICard
  title="Chiffre d'Affaires"
  value={125000}
  unit="FCFA"
  trend={{ value: 12, direction: 'up' }}
  icon={<MoneyIcon />}
  color="success"
/>
```

### StatusChip

Chip de statut avec couleur automatique.

**Props:**
```typescript
interface StatusChipProps {
  status: 'en_attente' | 'validee' | 'annulee' | 'payee' | 'impayee'
  size?: 'small' | 'medium'
}
```

**Mapping des couleurs:**
- `en_attente` → warning (orange)
- `validee` → success (vert)
- `annulee` → error (rouge)
- `payee` → success (vert)
- `impayee` → error (rouge)

## Composants de Formulaire

### FormField

Wrapper pour champs de formulaire avec label et erreur.

**Props:**
```typescript
interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  helperText?: string
  children: ReactNode
}
```

### Select / Dropdown

Menu déroulant pour sélectionner une option.

**Props:**
```typescript
interface SelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string, label: string }>
  placeholder?: string
  error?: boolean
  helperText?: string
  disabled?: boolean
  required?: boolean
  fullWidth?: boolean
}
```

### DatePicker

Sélecteur de date.

**Props:**
```typescript
interface DatePickerProps {
  label: string
  value: Date | null
  onChange: (date: Date | null) => void
  minDate?: Date
  maxDate?: Date
  error?: boolean
  helperText?: string
  disabled?: boolean
  required?: boolean
}
```

### SearchBar

Barre de recherche avec icône.

**Props:**
```typescript
interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onSearch?: () => void
  onClear?: () => void
}
```

## Composants de Graphiques

### LineChart

Graphique en ligne pour l'évolution temporelle.

**Props:**
```typescript
interface LineChartProps {
  data: Array<{ x: string | Date, y: number }>
  xAxisLabel?: string
  yAxisLabel?: string
  color?: string
  height?: number
}
```

### BarChart

Graphique en barres pour les comparaisons.

**Props:**
```typescript
interface BarChartProps {
  data: Array<{ label: string, value: number }>
  xAxisLabel?: string
  yAxisLabel?: string
  color?: string
  height?: number
  horizontal?: boolean
}
```

### PieChart

Graphique circulaire pour les proportions.

**Props:**
```typescript
interface PieChartProps {
  data: Array<{ label: string, value: number, color?: string }>
  height?: number
  showLegend?: boolean
}
```

## Patterns d'Utilisation

### Écran de Liste avec Recherche et Filtres

```tsx
function ProductListScreen() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  
  return (
    <Container>
      <AppBar title="Produits" />
      
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Rechercher un produit..."
      />
      
      <Select
        label="Catégorie"
        value={category}
        onChange={setCategory}
        options={[
          { value: 'all', label: 'Toutes' },
          { value: 'boisson', label: 'Boissons' },
          { value: 'nourriture', label: 'Nourriture' }
        ]}
      />
      
      <List
        items={filteredProducts}
        renderItem={(product) => (
          <ProductCard product={product} />
        )}
        keyExtractor={(p) => p.id}
      />
    </Container>
  )
}
```

### Formulaire avec Validation

```tsx
function ProductForm() {
  const [form, setForm] = useState({ nom: '', prix: 0, categorie: '' })
  const [errors, setErrors] = useState({})
  
  const handleSubmit = () => {
    // Validation
    const newErrors = {}
    if (!form.nom) newErrors.nom = 'Le nom est requis'
    if (form.prix <= 0) newErrors.prix = 'Le prix doit être positif'
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    // Soumission
    onSubmit(form)
  }
  
  return (
    <Card>
      <CardContent>
        <TextField
          label="Nom du produit"
          value={form.nom}
          onChange={(v) => setForm({ ...form, nom: v })}
          error={!!errors.nom}
          helperText={errors.nom}
          required
          fullWidth
        />
        
        <TextField
          label="Prix de vente"
          type="number"
          value={form.prix}
          onChange={(v) => setForm({ ...form, prix: Number(v) })}
          error={!!errors.prix}
          helperText={errors.prix}
          required
          fullWidth
        />
        
        <Select
          label="Catégorie"
          value={form.categorie}
          onChange={(v) => setForm({ ...form, categorie: v })}
          options={categories}
          required
          fullWidth
        />
      </CardContent>
      
      <CardActions>
        <Button variant="outlined" onClick={onCancel}>
          Annuler
        </Button>
        <Button variant="contained" onClick={handleSubmit}>
          Enregistrer
        </Button>
      </CardActions>
    </Card>
  )
}
```

### Dashboard avec KPIs et Graphiques

```tsx
function DashboardScreen() {
  const { data: kpis } = useKPIs()
  const { data: evolution } = useEvolutionCA()
  
  return (
    <Container>
      <AppBar title="Tableau de Bord" />
      
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="CA du jour"
            value={kpis.ca}
            unit="FCFA"
            trend={{ value: 12, direction: 'up' }}
            color="success"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Encaissements"
            value={kpis.encaissements}
            unit="FCFA"
            color="primary"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Créances"
            value={kpis.creances}
            unit="FCFA"
            color="warning"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Bénéfice"
            value={kpis.benefice}
            unit="FCFA"
            color="success"
          />
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="Évolution du CA" />
            <CardContent>
              <LineChart
                data={evolution}
                xAxisLabel="Heure"
                yAxisLabel="Montant (FCFA)"
                height={300}
              />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Ventes par catégorie" />
            <CardContent>
              <PieChart
                data={ventesParCategorie}
                height={300}
                showLegend
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  )
}
```

## Notes d'Implémentation

### React Native vs React Web

Certains composants nécessitent des adaptations entre React Native et React Web :

**React Native:**
- Utiliser `react-native-paper` pour les composants Material Design
- Utiliser `react-navigation` pour la navigation
- Utiliser `AsyncStorage` pour le stockage local
- Utiliser `react-native-chart-kit` pour les graphiques

**React Web:**
- Utiliser `@mui/material` pour les composants Material Design
- Utiliser `react-router-dom` pour la navigation
- Utiliser `localStorage` pour le stockage local
- Utiliser `recharts` pour les graphiques

### Accessibilité

Tous les composants doivent respecter les standards d'accessibilité :
- Labels appropriés pour les champs de formulaire
- Contraste de couleurs suffisant (WCAG AA minimum)
- Support de la navigation au clavier
- Attributs ARIA pour les lecteurs d'écran
- Tailles de touche minimales (44x44px sur mobile)

### Performance

Optimisations recommandées :
- Utiliser `React.memo` pour les composants purs
- Utiliser `useMemo` et `useCallback` pour éviter les re-renders
- Lazy loading des composants lourds
- Virtualisation des longues listes (react-window)
- Optimistic updates pour une meilleure UX

### Tests

Chaque composant doit avoir :
- Tests unitaires (Jest + React Testing Library)
- Tests de snapshot pour détecter les régressions visuelles
- Tests d'accessibilité (jest-axe)
- Storybook pour la documentation visuelle (optionnel)

## Prochaines Étapes

1. **Extraire les composants des maquettes HTML** : Analyser les 15 maquettes fournies et compléter ce document avec les détails exacts (couleurs, dimensions, comportements)

2. **Créer une bibliothèque de composants** : Implémenter tous les composants réutilisables dans un package partagé

3. **Documenter avec Storybook** : Créer des stories pour chaque composant avec toutes les variantes

4. **Implémenter les écrans** : Utiliser ces composants pour construire les écrans des trois applications

5. **Tests visuels** : Mettre en place des tests de régression visuelle (Chromatic, Percy)

---

**Note**: Ce document sera mis à jour au fur et à mesure de l'analyse des maquettes HTML et de l'implémentation des composants.
