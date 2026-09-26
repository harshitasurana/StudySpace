import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const target = process.argv[2]; // 'sqlite' or 'postgres'
if (!target || (target !== 'sqlite' && target !== 'postgres')) {
  console.error('Usage: node scripts/switch-db.js <sqlite|postgres>');
  process.exit(1);
}

function updateEnvFile(filePath, targetDb) {
  if (!fs.existsSync(filePath)) return;
  console.log(`📝 Updating env file: ${path.basename(filePath)}`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (targetDb === 'sqlite') {
    content = content.replace(
      /DATABASE_URL\s*=\s*".*?"/g,
      'DATABASE_URL="sqlite://./healthcare.db"'
    );
    if (content.includes('USE_SQLITE')) {
      content = content.replace(/USE_SQLITE\s*=\s*".*?"/g, 'USE_SQLITE="true"');
      content = content.replace(/USE_SQLITE\s*=\s*\w+/g, 'USE_SQLITE="true"');
    } else {
      content += '\nUSE_SQLITE="true"\n';
    }
  } else {
    content = content.replace(
      /DATABASE_URL\s*=\s*".*?"/g,
      'DATABASE_URL="postgresql://dev_user:dev_pass@192.168.0.197:5432/healthcare_dev?schema=public"'
    );
    if (content.includes('USE_SQLITE')) {
      content = content.replace(/USE_SQLITE\s*=\s*".*?"/g, 'USE_SQLITE="false"');
      content = content.replace(/USE_SQLITE\s*=\s*\w+/g, 'USE_SQLITE="false"');
    } else {
      content += '\nUSE_SQLITE="false"\n';
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

updateEnvFile(path.join(__dirname, '../.env'), target);

console.log('✅ Database switch complete.');
