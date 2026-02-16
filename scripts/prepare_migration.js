
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');
const OUTPUT_FILE = path.join(__dirname, '../migration/schema.sql');

// Files to skip entirely (RLS, Auth config, Data migration)
const SKIP_FILES = [
  '20240116000000_configure_auth.sql', // Auth config
  '20240116000002_rls_policies.sql', // RLS
  '20240117000000_products_stock_rls.sql', // RLS
  '20240118000000_commandes_rls.sql', // RLS
  '20240119000000_ravitaillements_rls.sql', // RLS
  '20240121000000_factures_rls.sql', // RLS
  '20240121000002_encaissements_rls.sql', // RLS
  '20240124000000_tables_rls.sql', // RLS
  '20240128000003_migrate_existing_data.sql', // Data migration (we do it separately)
  '20240128000005_multi_tenant_rls_policies.sql', // RLS
  '20240128000006_admin_rls_policies.sql', // RLS
];

// Patterns to remove from kept files
const REMOVE_PATTERNS = [
  /create policy/i,
  /alter table .* enable row level security/i,
  /create trigger .* on auth\./i, // Triggers on auth tables
  /grant .* on table .* to .*/i, // Permissions might need to be redefined
];

function processMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Ensure chronological order

  let fullSchema = '-- SCHEMA MIGRATION (Generated)\n\n';

  for (const file of files) {
    if (SKIP_FILES.some(skip => file.includes(skip))) {
      console.log(`Skipping file: ${file}`);
      continue;
    }

    console.log(`Processing file: ${file}`);
    let content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    // Remove unwanted lines with state machine for multi-line statements
    const lines = content.split('\n');
    const filteredLines = [];
    let skippingPolicy = false;
    let skippingTrigger = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Start skipping policy
      if (/create policy/i.test(line)) {
        skippingPolicy = true;
      }
      
      // Start skipping trigger on auth
      if (/create trigger .* on auth\./i.test(line)) {
        skippingTrigger = true;
      }

      // Start skipping enable RLS
      if (/alter table .* enable row level security/i.test(line)) {
         // This is usually one line, but just in case
         if (trimmed.endsWith(';')) {
             continue;
         }
         // If multi-line (rare), add logic here
      }

      // Check strict single line removal
      if (REMOVE_PATTERNS.some(p => p.test(line))) {
          // If it's a start of a block we are already handling, good.
          // If it's a single line like GRANT, skip it.
          if (!skippingPolicy && !skippingTrigger) {
             // Check if it ends with semicolon
             if (trimmed.endsWith(';')) {
                 continue; 
             }
             // If it doesn't end with semicolon, it might be multi-line GRANT?
             // Assume GRANTs are single line or we skip until ;
             // For safety, let's treat GRANT as skip-until-semicolon too if needed.
             // But for now, let's stick to the main culprits.
          }
      }

      if (skippingPolicy) {
        if (trimmed.endsWith(';')) {
          skippingPolicy = false;
        }
        continue;
      }

      if (skippingTrigger) {
        if (trimmed.endsWith(';')) {
          skippingTrigger = false;
        }
        continue;
      }

      // Additional cleanup: Remove DROP POLICY lines as they are noise
      if (/drop policy/i.test(line)) continue;

      filteredLines.push(line);
    }

    fullSchema += `-- Source: ${file}\n`;
    fullSchema += filteredLines.join('\n');
    fullSchema += '\n\n';
  }

  fs.writeFileSync(OUTPUT_FILE, fullSchema);
  console.log(`Schema saved to ${OUTPUT_FILE}`);
}

processMigrations();
