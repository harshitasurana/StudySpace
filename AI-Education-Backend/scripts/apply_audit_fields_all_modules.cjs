const fs = require('fs');
const path = require('path');

const reqFields = ['created_at', 'updated_at', 'created_by', 'updated_by', 'created_by_name', 'updated_by_name'];

const fieldDefs = {
  created_at: `    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },`,
  updated_at: `    updated_at: {
      type: DataTypes.DATE,
    },`,
  created_by: `    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },`,
  updated_by: `    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },`,
  created_by_name: `    created_by_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },`,
  updated_by_name: `    updated_by_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },`,
};

function getAllFiles(dir, files = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) getAllFiles(p, files);
    else if (f.endsWith('.js') && f.includes('schema')) files.push(p);
  }
  return files;
}

function updateSchemaFiles() {
  const files = getAllFiles('./src/api');
  let updatedModels = 0;
  let updatedFilters = 0;

  files.forEach(filepath => {
    let content = fs.readFileSync(filepath, 'utf8');
    const isFilter = filepath.includes('filter');

    if (!isFilter) {
      const defineIndices = [];
      let idx = content.indexOf('sequelize.define(');
      while (idx !== -1) {
        defineIndices.push(idx);
        idx = content.indexOf('sequelize.define(', idx + 1);
      }

      if (defineIndices.length > 0) {
        let fileChanged = false;
        for (let i = defineIndices.length - 1; i >= 0; i--) {
          const startIdx = defineIndices[i];
          const openBraceIdx = content.indexOf('{', startIdx);
          if (openBraceIdx === -1) continue;

          let depth = 1;
          let closeBraceIdx = -1;
          for (let j = openBraceIdx + 1; j < content.length; j++) {
            if (content[j] === '{') depth++;
            else if (content[j] === '}') {
              depth--;
              if (depth === 0) {
                closeBraceIdx = j;
                break;
              }
            }
          }

          if (closeBraceIdx === -1) continue;

          const attrBlock = content.slice(openBraceIdx, closeBraceIdx + 1);
          const missing = reqFields.filter(f => {
            const regex = new RegExp(`\\b${f}\\s*:`);
            return !regex.test(attrBlock);
          });

          if (missing.length > 0) {
            const textBeforeClose = content.slice(openBraceIdx, closeBraceIdx).trimEnd();
            const needsComma = !textBeforeClose.endsWith(',') && !textBeforeClose.endsWith('{');
            const prefix = needsComma ? ',\n' : '\n';
            const toInsert = prefix + missing.map(f => fieldDefs[f]).join('\n') + '\n  ';
            content = content.slice(0, closeBraceIdx) + toInsert + content.slice(closeBraceIdx);
            fileChanged = true;
          }
        }
        if (fileChanged) {
          fs.writeFileSync(filepath, content, 'utf8');
          updatedModels++;
        }
      }
    } else {
      let modified = false;

      if (content.includes('exact: [')) {
        ['created_by', 'updated_by'].forEach(f => {
          if (!content.includes(`'${f}'`) && !content.includes(`"${f}"`)) {
            content = content.replace(/exact:\s*\[/, `exact: [\n    '${f}',`);
            modified = true;
          }
        });
      }

      if (content.includes('number: [')) {
        ['created_by', 'updated_by'].forEach(f => {
          if (!content.includes(`'${f}'`) && !content.includes(`"${f}"`)) {
            content = content.replace(/number:\s*\[/, `number: [\n      '${f}',`);
            modified = true;
          }
        });
      }

      if (content.includes('date: [')) {
        ['created_at', 'updated_at'].forEach(f => {
          if (!content.includes(`'${f}'`) && !content.includes(`"${f}"`)) {
            content = content.replace(/date:\s*\[/, `date: [\n      '${f}',`);
            modified = true;
          }
        });
      }

      if (content.includes('sortable: [')) {
        reqFields.forEach(f => {
          if (!content.includes(`'${f}'`) && !content.includes(`"${f}"`)) {
            content = content.replace(/sortable:\s*\[/, `sortable: [\n    '${f}',`);
            modified = true;
          }
        });
      }

      if (content.includes('searchable: [')) {
        ['created_by_name', 'updated_by_name'].forEach(f => {
          if (!content.includes(`'${f}'`) && !content.includes(`"${f}"`)) {
            content = content.replace(/searchable:\s*\[/, `searchable: [\n    '${f}',`);
            modified = true;
          }
        });
      }

      if (modified) {
        fs.writeFileSync(filepath, content, 'utf8');
        updatedFilters++;
      }
    }
  });

  console.log(`Updated model definitions in ${updatedModels} files.`);
  console.log(`Updated filter schema in ${updatedFilters} files.`);
}

function updateSpecificFilters() {
  const updates = [
    ['src/api/doctor/doctor.filter.schema.js', "'position_title'", "'position_title',\n    'created_by_name', 'updated_by_name'"],
    ['src/api/feature/feature.filter.schema.js', "'router_link',", "'router_link',\n    'created_by_name',\n    'updated_by_name',"],
    ['src/api/staff/staff.filter.schema.js', "'avatar'", "'avatar',\n    'created_by_name',\n    'updated_by_name'"],
    ['src/api/roles/role_template.filter.schema.js', 'const searchable = [];', "const searchable = ['created_by_name', 'updated_by_name'];"],
    ['src/api/records/records_filter_schema.js', 'place_of_birth: { type: "string", matchMode: "contains" },', 'place_of_birth: { type: "string", matchMode: "contains" },\n    created_by_name: { type: "string", matchMode: "contains" },\n    updated_by_name: { type: "string", matchMode: "contains" },'],
    ['src/api/records/records_filter_schema.js', 'created_by: { type: "integer" },', 'created_by: { type: "integer" },\n    updated_by: { type: "integer" },'],
  ];

  updates.forEach(([file, from, to]) => {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes(to)) {
      fs.writeFileSync(file, content.replace(from, to), 'utf8');
    }
  });
}

updateSchemaFiles();
updateSpecificFilters();
