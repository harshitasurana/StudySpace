const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getFiles(dir, files = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) getFiles(p, files);
    else if (f.endsWith('.js') && (f.includes('route') || f.includes('controller'))) files.push(p);
  }
  return files;
}

const auditFieldsYaml = [
  'created_by:\n *           type: integer\n *           nullable: true\n *           example: 1',
  'created_by_name:\n *           type: string\n *           nullable: true\n *           example: "Admin User"',
  'updated_by:\n *           type: integer\n *           nullable: true\n *           example: 1',
  'updated_by_name:\n *           type: string\n *           nullable: true\n *           example: "Admin User"',
  'created_at:\n *           type: string\n *           format: date-time\n *           example: "2026-01-01T00:00:00Z"',
  'updated_at:\n *           type: string\n *           format: date-time\n *           example: "2026-01-01T00:00:00Z"'
];

const targetFields = ['created_at', 'updated_at', 'created_by', 'updated_by', 'created_by_name', 'updated_by_name'];

const files = getFiles('./src/api');
let updatedCount = 0;

files.forEach(filepath => {
  let content = fs.readFileSync(filepath, 'utf8');
  if (!content.includes('@swagger') || !content.includes('schemas:')) return;

  let modified = false;

  // Split by JSDoc comment blocks
  const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;

  content = content.replace(jsdocRegex, (block) => {
    if (!block.includes('@swagger') || !block.includes('properties:')) return block;

    // Only target response / model schema definitions (e.g. DoctorResponse, TemplateCategory, Patient, etc.)
    // Skip create/request schemas unless they are full object schemas
    if (block.includes('Create') && !block.includes('Response')) return block;

    let newBlock = block;
    const lines = newBlock.split('\n');
    let inProperties = false;
    let propIndent = '';
    let lastPropIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('properties:')) {
        inProperties = true;
        // Determine indentation of properties block
        const match = line.match(/^(\s*\*\s*)/);
        if (match) propIndent = match[1];
        continue;
      }

      if (inProperties) {
        // If line is closing JSDoc or starting a new YAML section at same or higher level
        if (line.includes('*/') || /^\s*\*\s{0,8}[A-Za-z0-9_-]+:/.test(line) && !line.includes('type:') && !line.includes('example:') && !line.includes('description:') && !line.includes('format:')) {
          // Check if this is the end of properties
          if (/^\s*\*\s{2,6}[A-Za-z0-9_-]+:/.test(line)) {
            inProperties = false;
          }
        }

        if (inProperties && /^\s*\*\s{8,12}[a-zA-Z0-9_]+:/.test(line)) {
          lastPropIndex = i;
        }
      }
    }

    if (lastPropIndex !== -1) {
      const missing = targetFields.filter(f => !newBlock.includes(f + ':'));
      if (missing.length > 0) {
        const addedLines = [];
        missing.forEach(f => {
          switch (f) {
            case 'created_by':
              addedLines.push(' *         created_by:\n *           type: integer\n *           nullable: true\n *           example: 1');
              break;
            case 'created_by_name':
              addedLines.push(' *         created_by_name:\n *           type: string\n *           nullable: true\n *           example: "Admin User"');
              break;
            case 'updated_by':
              addedLines.push(' *         updated_by:\n *           type: integer\n *           nullable: true\n *           example: 1');
              break;
            case 'updated_by_name':
              addedLines.push(' *         updated_by_name:\n *           type: string\n *           nullable: true\n *           example: "Admin User"');
              break;
            case 'created_at':
              addedLines.push(' *         created_at:\n *           type: string\n *           format: date-time\n *           example: "2026-01-01T00:00:00Z"');
              break;
            case 'updated_at':
              addedLines.push(' *         updated_at:\n *           type: string\n *           format: date-time\n *           example: "2026-01-01T00:00:00Z"');
              break;
          }
        });

        // Insert added lines after lastPropIndex
        lines.splice(lastPropIndex + 1, 0, ...addedLines.join('\n').split('\n'));
        newBlock = lines.join('\n');
        modified = true;
      }
    }

    return newBlock;
  });

  if (modified) {
    fs.writeFileSync(filepath, content, 'utf8');
    updatedCount++;
  }
});

console.log('Updated inline Swagger schemas in', updatedCount, 'route files.');
