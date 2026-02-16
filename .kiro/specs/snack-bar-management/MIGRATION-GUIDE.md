# Guide de Migration : Node.js → Supabase

## Vue d'Ensemble

Ce document explique les changements majeurs entre l'architecture on-premise Node.js (sauvegardée) et la nouvelle architecture Supabase serverless.

## Changements Architecturaux Majeurs

### 1. Backend : De Node.js/NestJS à Supabase

#### Avant (On-Premise)
```typescript
// Backend Node.js à coder entièrement
@Controller('commandes')
export class CommandeController {
  @Post()
  async create(@Body() dto: CreateCommandeDto) {
    // Logique métier à coder
    // Validation à coder
    // Gestion des erreurs à coder
  }
  
  @Get()
  async findAll(@Query() filters) {
    // Requêtes SQL à écrire
  }
}
```

#### Maintenant (Supabase)
```typescript
// API REST auto-générée, pas de code backend !
const { data, error } = await supabase
  .from('commandes')
  .insert({ table_id, items })
  
// Ou utiliser une fonction PostgreSQL
const { data, error } = await supabase
  .rpc('create_commande', { table_id, items })
```

**Gain** : ~70% de code backend en moins

---

### 2. Authentification : De Passport.js à Supabase Auth

#### Avant (On-Premise)
```typescript
// À coder : Passport.js + JWT + bcrypt
@Injectable()
export class AuthService {
  async login(email: string, password: string) {
    const user = await this.findUser(email)
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) throw new UnauthorizedException()
    const token = this.jwtService.sign({ sub: user.id })
    return { token }
  }
}

// Middleware à coder
@Injectable()
export class AuthGuard {
  canActivate(context: ExecutionContext) {
    // Vérification du token
    // Extraction de l'utilisateur
  }
}
```

#### Maintenant (Supabase)
```typescript
// Intégré, pas de code !
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
})

// Session gérée automatiquement
const { data: { user } } = await supabase.auth.getUser()
```

**Gain** : ~90% de code auth en moins

---

### 3. Permissions : De Middlewares à Row Level Security

#### Avant (On-Premise)
```typescript
// Middleware à coder pour chaque endpoint
@UseGuards(RoleGuard)
@Roles('serveuse')
@Get('my-commandes')
async getMyCommandes(@CurrentUser() user) {
  return this.commandeService.findByServeuse(user.id)
}

// Service à coder
async findByServeuse(serveuseId: string) {
  return this.prisma.commande.findMany({
    where: { serveuseId }
  })
}
```

#### Maintenant (Supabase)
```sql
-- Row Level Security : Permissions au niveau base de données
CREATE POLICY "serveuses_own_commandes" ON commandes
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'serveuse' 
    AND serveuse_id = auth.uid()
  );
```

```typescript
// Côté client : Filtrage automatique !
const { data } = await supabase
  .from('commandes')
  .select('*')
// Retourne automatiquement uniquement les commandes de la serveuse
```

**Gain** : Sécurité garantie même si le client est compromis

---

### 4. Realtime : De Socket.io à Supabase Realtime

#### Avant (On-Premise)
```typescript
// Serveur Socket.io à configurer
@WebSocketGateway()
export class EventsGateway {
  @WebSocketServer()
  server: Server
  
  handleCommandeCreated(commande: Commande) {
    this.server.to('comptoir').emit('commande.created', commande)
  }
}

// Client à configurer
const socket = io('http://localhost:3000')
socket.on('commande.created', (commande) => {
  // Mise à jour UI
})
```

#### Maintenant (Supabase)
```typescript
// Subscription native PostgreSQL
const channel = supabase
  .channel('commandes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'commandes'
  }, (payload) => {
    // Mise à jour UI automatique
  })
  .subscribe()
```

**Gain** : Pas de serveur WebSocket à gérer, RLS s'applique aussi au Realtime

---

### 5. Déploiement : De Docker à Serverless

#### Avant (On-Premise)
```yaml
# docker-compose.yml à maintenir
version: '3.8'
services:
  backend:
    build: ./backend
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
  postgres:
    image: postgres:15
    volumes: [postgres_data:/var/lib/postgresql/data]
  redis:
    image: redis:7
  nginx:
    image: nginx
    ports: ["80:80", "443:443"]
```

**Maintenance** :
- Mises à jour de sécurité manuelles
- Monitoring à configurer
- Backups à automatiser
- Scaling manuel
- Serveur physique à gérer

#### Maintenant (Supabase)
```bash
# Déploiement frontend uniquement
git push origin main
# Vercel déploie automatiquement
```

**Maintenance** :
- ✅ Mises à jour automatiques
- ✅ Monitoring intégré
- ✅ Backups automatiques
- ✅ Scaling automatique
- ✅ Pas de serveur à gérer

---

## Comparaison des Tâches

### Phase 1 : Infrastructure

| Tâche | On-Premise | Supabase |
|-------|------------|----------|
| **Setup** | Installer Node.js, PostgreSQL, Redis, Docker | Créer un compte Supabase (5 min) |
| **Configuration** | docker-compose.yml, .env, nginx.conf | Interface web Supabase |
| **Migrations** | Prisma migrations à coder | SQL dans l'éditeur Supabase |
| **Temps** | 1-2 jours | 1-2 heures |

### Phase 2 : Authentification

| Tâche | On-Premise | Supabase |
|-------|------------|----------|
| **Auth** | Coder Passport.js + JWT + bcrypt | Activer Supabase Auth |
| **RBAC** | Coder middlewares + guards | Écrire RLS policies |
| **Audit** | Coder service + middleware | Créer triggers PostgreSQL |
| **Temps** | 3-5 jours | 1 jour |

### Phase 3-7 : Logique Métier

| Tâche | On-Premise | Supabase |
|-------|------------|----------|
| **CRUD** | Coder controllers + services | API auto-générée |
| **Validation** | Coder avec Zod/Joi | Contraintes PostgreSQL + RLS |
| **Business Logic** | Coder dans services | Fonctions PostgreSQL |
| **Temps** | 15-20 jours | 5-7 jours |

### Phase 8 : Realtime

| Tâche | On-Premise | Supabase |
|-------|------------|----------|
| **WebSocket** | Configurer Socket.io | Activer Realtime |
| **Events** | Coder event handlers | Subscriptions natives |
| **Retry** | Coder logique de retry | Géré automatiquement |
| **Temps** | 3-5 jours | 1 jour |

### Phase 9-11 : Frontend

| Tâche | On-Premise | Supabase |
|-------|------------|----------|
| **API Client** | Axios + interceptors | @supabase/supabase-js |
| **Auth** | Gérer tokens manuellement | Géré automatiquement |
| **Realtime** | socket.io-client | Supabase Realtime |
| **Temps** | 20-25 jours | 15-20 jours |

### Phase 12 : Déploiement

| Tâche | On-Premise | Supabase |
|-------|------------|----------|
| **Infrastructure** | Acheter serveur, configurer réseau | Rien |
| **Déploiement** | Docker, nginx, SSL | Git push |
| **Monitoring** | Configurer Prometheus/Grafana | Dashboard Supabase |
| **Temps** | 3-5 jours | 1 heure |

---

## Temps de Développement Total

| Phase | On-Premise | Supabase | Gain |
|-------|------------|----------|------|
| **Infrastructure** | 2 jours | 2 heures | -90% |
| **Backend** | 25 jours | 8 jours | -68% |
| **Frontend** | 25 jours | 20 jours | -20% |
| **Déploiement** | 5 jours | 1 heure | -98% |
| **TOTAL** | **~60 jours** | **~30 jours** | **-50%** |

---

## Coûts Comparés (1 snack-bar, 3 ans)

### On-Premise
| Année | Coûts |
|-------|-------|
| Année 1 | 1,500 USD (serveur + installation) |
| Année 2 | 300 USD (maintenance) |
| Année 3 | 300 USD (maintenance) |
| **Total** | **2,100 USD** |

### Supabase
| Année | Coûts |
|-------|-------|
| Année 1 | 300 USD (25 USD/mois) |
| Année 2 | 300 USD |
| Année 3 | 300 USD |
| **Total** | **900 USD** |

**Économie** : 1,200 USD sur 3 ans pour 1 snack-bar

---

## Migration Future vers On-Premise

Si tu décides de migrer vers on-premise plus tard (après 30-50 snack-bars), voici le processus :

### Étape 1 : Préparation (1 mois)
1. Recruter/former équipe DevOps
2. Acheter matériel (serveurs, routeurs)
3. Développer le backend Node.js en utilisant `design-onpremise-backup.md` et `tasks-onpremise-backup.md`
4. Tester en environnement de staging

### Étape 2 : Migration des Données
```bash
# Export depuis Supabase
supabase db dump > backup.sql

# Import vers PostgreSQL local
psql -U user -d snackbar < backup.sql
```

### Étape 3 : Adaptation du Frontend
```typescript
// Changer l'URL Supabase
const supabase = createClient(
  'http://localhost:3000', // Au lieu de l'URL Supabase Cloud
  'local-anon-key'
)
```

### Étape 4 : Rollout Progressif
- Migrer 2-3 snack-bars par semaine
- Maintenir Supabase en backup pendant 3 mois
- Monitoring intensif

---

## Recommandation

**Démarrer avec Supabase** est la meilleure stratégie pour :
- ✅ Valider le marché rapidement
- ✅ Minimiser l'investissement initial
- ✅ Éviter les compétences DevOps
- ✅ Accès distant natif pour les patrons

**Migrer vers on-premise** seulement si :
- ✓ 30-50 snack-bars actifs
- ✓ Coûts Supabase > 1,000 USD/mois
- ✓ Équipe DevOps disponible
- ✓ Budget infrastructure disponible

Les fichiers de backup (`design-onpremise-backup.md` et `tasks-onpremise-backup.md`) serviront de référence pour cette migration future.
