import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const defaultFrontendRoot = path.resolve(backendRoot, '..', 'healthcare-frontend');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const legacyEndpoints = args.includes('--legacy-endpoints');
const forceServices = force || args.includes('--force-services');
const forceModels = args.includes('--force-models');
const createMissing = args.includes('--create-missing');

const frontendArg = readArgValue('--frontend');
const entitiesArg = readArgValue('--entities');

const frontendRoot = frontendArg
  ? path.resolve(process.cwd(), frontendArg)
  : defaultFrontendRoot;

const appFile = path.join(backendRoot, 'src', 'app.js');
const frontendPagesDir = path.join(frontendRoot, 'src', 'app', 'pages');

const ROUTE_MAPPINGS = {
  admin: {
    pageDir: 'Admin',
    modelDir: 'models',
    modelFile: 'AdminProfile.model.ts',
    serviceDir: 'services',
    serviceFile: 'AdminProfile.service.ts',
  },
  hospitals: {
    pageDir: 'Hospital',
    modelDir: 'models',
    modelFile: 'hospital.model.ts',
    serviceDir: 'service',
    serviceFile: 'hospital.service.ts',
  },
  users: {
    pageDir: 'Admin',
    modelDir: 'models',
    modelFile: 'AdminProfile.model.ts',
    serviceDir: 'services',
    serviceFile: 'AdminProfile.service.ts',
  },
  profile: {
    pageDir: 'Admin',
    modelDir: 'models',
    modelFile: 'AdminProfile.model.ts',
    serviceDir: 'services',
    serviceFile: 'AdminProfile.service.ts',
  },
  appointments: {
    pageDir: 'Appointment',
    modelDir: 'model',
    modelFile: 'Appointment.model.ts',
    serviceDir: 'services',
    serviceFile: 'Appointment.service.ts',
  },
  departments: {
    pageDir: 'Department',
    modelDir: 'model',
    modelFile: 'department.model.ts',
    serviceDir: 'service',
    serviceFile: 'department.service.ts',
  },
  services: {
    pageDir: 'Department',
    modelDir: 'model',
    modelFile: 'department.model.ts',
    serviceDir: 'service',
    serviceFile: 'department-service.service.ts',
  },
  doctors: {
    pageDir: 'Doctor',
    modelDir: 'models',
    modelFile: 'Doctor.model.ts',
    serviceDir: 'service',
    serviceFile: 'doctor.service.ts',
  },
  patients: {
    pageDir: 'Patient',
    modelDir: 'models',
    modelFile: 'patient.model.ts',
    serviceDir: 'service',
    serviceFile: 'patient.service.ts',
  },
  settings: {
    pageDir: 'settings',
    modelDir: 'model',
    modelFile: 'settings.model.ts',
    serviceDir: 'service',
    serviceFile: 'settings.service.ts',
  },
  pharmacies: {
    pageDir: 'Pharmacy',
    modelDir: 'model',
    modelFile: 'medicine.model.ts',
    serviceDir: 'service',
    serviceFile: 'medicine.service.ts',
  },
  prescriptions: {
    pageDir: 'Prescriptions',
    modelDir: 'models',
    modelFile: 'prescription.model.ts',
    serviceDir: 'service',
    serviceFile: 'prescription.service.ts',
  },
  features: {
    pageDir: 'Admin/access-control',
    modelDir: 'models',
    modelFile: 'feature.model.ts',
    serviceDir: 'service',
    serviceFile: 'feature.service.ts',
  },
  metadata: {
    pageDir: '../../../libs/core',
    modelDir: '../models',
    modelFile: 'location.model.ts',
    serviceDir: 'service',
    serviceFile: 'location.service.ts',
  },
  menu: {
    pageDir: '../layout',
    modelDir: 'model',
    modelFile: 'menu.model.ts',
    serviceDir: 'service',
    serviceFile: 'menu.service.ts',
  },
  'user-preferences': {
    pageDir: '..',
    modelDir: 'models',
    modelFile: 'preferences.model.ts',
    serviceDir: 'service',
    serviceFile: 'preferences.service.ts',
  },
  'dashboard/doctors': {
    pageDir: 'Doctor',
    modelDir: 'models',
    modelFile: 'Doctor.model.ts',
    serviceDir: 'service',
    serviceFile: 'doctordashboard.service.ts',
  },
  'dashboard/patient': {
    pageDir: 'Patient',
    modelDir: 'models',
    modelFile: 'patient.model.ts',
    serviceDir: 'service',
    serviceFile: 'patientdashboard.service.ts',
  },
  roles: {
    pageDir: 'Admin/access-control',
    modelDir: 'models',
    modelFile: 'Role.model.ts',
    serviceDir: 'service',
    serviceFile: 'role.service.ts',
  },
  staff: {
    pageDir: 'Staff',
    modelDir: 'models',
    modelFile: 'staff.model.ts',
    serviceDir: 'service',
    serviceFile: 'staff.service.ts',
  },
  'feature-permissions': {
    pageDir: 'Admin/access-control',
    modelDir: 'models',
    modelFile: 'feature-permissions.model.ts',
    serviceDir: 'service',
    serviceFile: 'feature-permission.service.ts',
  },
  'feature-custom-permissions': {
    pageDir: 'Admin/access-control',
    modelDir: 'models',
    modelFile: 'feature-permissions.model.ts',
    serviceDir: 'service',
    serviceFile: 'feature-permission.service.ts',
  },
  audit: {
    pageDir: 'Admin/access-control',
    modelDir: 'models',
    modelFile: 'audit-log.model.ts',
    serviceDir: 'service',
    serviceFile: 'audit-log.service.ts',
  },
  'role-template': {
    pageDir: 'Admin/access-control',
    modelDir: 'models',
    modelFile: 'template.model.ts',
    serviceDir: 'service',
    serviceFile: 'template.service.ts',
  },
  'role-templates': {
    pageDir: 'Admin/access-control',
    modelDir: 'models',
    modelFile: 'template.model.ts',
    serviceDir: 'service',
    serviceFile: 'template.service.ts',
  },
  templates: {
    pageDir: 'Admin/access-control',
    modelDir: 'models',
    modelFile: 'template.model.ts',
    serviceDir: 'service',
    serviceFile: 'template.service.ts',
  },
  specializations: {
    pageDir: 'Doctor',
    modelDir: 'models',
    modelFile: 'Specialization.model.ts',
    serviceDir: 'service',
    serviceFile: 'Specializations.service.ts',
  },
  ambulances: {
    pageDir: 'Ambulance',
    modelDir: 'models',
    modelFile: 'ambulance.model.ts',
    serviceDir: 'service',
    serviceFile: 'ambulance.service.ts',
  },
  billing: {
    pageDir: 'Billing',
    modelDir: 'models',
    modelFile: 'billing.model.ts',
    serviceDir: 'service',
    serviceFile: 'billing.service.ts',
  },
  'blood-bank': {
    pageDir: 'BloodBank',
    modelDir: 'models',
    modelFile: 'blood-bank.model.ts',
    serviceDir: 'service',
    serviceFile: 'blood-bank.service.ts',
  },
  calendar: {
    pageDir: 'Calendar',
    modelDir: 'models',
    modelFile: 'calendar.model.ts',
    serviceDir: 'service',
    serviceFile: 'calendar.service.ts',
  },
  contacts: {
    pageDir: 'Contact',
    modelDir: 'models',
    modelFile: 'contact.model.ts',
    serviceDir: 'service',
    serviceFile: 'contact.service.ts',
  },
  dashboard: {
    pageDir: 'Dashboard',
    modelDir: 'models',
    modelFile: 'dashboard.model.ts',
    serviceDir: 'service',
    serviceFile: 'dashboard.service.ts',
  },
  favorites: {
    pageDir: 'Favorites',
    modelDir: 'models',
    modelFile: 'favorites.model.ts',
    serviceDir: 'service',
    serviceFile: 'favorites.service.ts',
  },
  feedback: {
    pageDir: 'Feedback',
    modelDir: 'models',
    modelFile: 'feedback.model.ts',
    serviceDir: 'service',
    serviceFile: 'feedback.service.ts',
  },
  inventory: {
    pageDir: 'Inventory',
    modelDir: 'models',
    modelFile: 'inventory.model.ts',
    serviceDir: 'service',
    serviceFile: 'inventory.service.ts',
  },
  records: {
    pageDir: 'Records',
    modelDir: 'models',
    modelFile: 'records.model.ts',
    serviceDir: 'service',
    serviceFile: 'records.service.ts',
  },
  reports: {
    pageDir: 'Reports',
    modelDir: 'models',
    modelFile: 'reports.model.ts',
    serviceDir: 'service',
    serviceFile: 'reports.service.ts',
  },
  reviews: {
    pageDir: 'Reviews',
    modelDir: 'models',
    modelFile: 'reviews.model.ts',
    serviceDir: 'service',
    serviceFile: 'reviews.service.ts',
  },
  rooms: {
    pageDir: 'Room',
    modelDir: 'models',
    modelFile: 'room.model.ts',
    serviceDir: 'service',
    serviceFile: 'room.service.ts',
  },
  search: {
    pageDir: 'Search',
    modelDir: 'models',
    modelFile: 'search.model.ts',
    serviceDir: 'service',
    serviceFile: 'search.service.ts',
  },
  support: {
    pageDir: 'Support',
    modelDir: 'models',
    modelFile: 'support.model.ts',
    serviceDir: 'service',
    serviceFile: 'support.service.ts',
  },
  tasks: {
    pageDir: 'Tasks',
    modelDir: 'models',
    modelFile: 'tasks.model.ts',
    serviceDir: 'service',
    serviceFile: 'tasks.service.ts',
  },
  whatsapp: {
    pageDir: 'Whatsapp',
    modelDir: 'models',
    modelFile: 'whatsapp.model.ts',
    serviceDir: 'service',
    serviceFile: 'whatsapp.service.ts',
  },
  'lab-results': {
    pageDir: 'LabResults',
    modelDir: 'models',
    modelFile: 'lab-results.model.ts',
    serviceDir: 'service',
    serviceFile: 'lab-results.service.ts',
  },
};

function readArgValue(flag) {
  const index = args.findIndex((arg) => arg === flag);
  if (index === -1 || index === args.length - 1) {
    return null;
  }
  return args[index + 1];
}

function toPascalCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[-_\s/]+/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join('');
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : '';
}

function pluralize(word) {
  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }
  if (/(s|x|z|ch|sh)$/i.test(word)) {
    return `${word}es`;
  }
  return `${word}s`;
}

function toKebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function ensureDir(dirPath) {
  if (dryRun) {
    return;
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

function listChildDirs(parentDir) {
  if (!fs.existsSync(parentDir)) return [];
  return fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function findEntryCaseInsensitive(entries, candidates) {
  const lowered = new Map(entries.map((entry) => [entry.toLowerCase(), entry]));
  for (const candidate of candidates) {
    const hit = lowered.get(candidate.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function findExistingPageDir(folderName) {
  const dirs = listChildDirs(frontendPagesDir);
  const candidates = [
    toPascalCase(folderName),
    toCamelCase(folderName),
    toKebabCase(folderName),
    folderName,
  ];
  const found = findEntryCaseInsensitive(dirs, candidates);
  return found ? path.join(frontendPagesDir, found) : null;
}

function pickExistingSubDir(pageDir, candidates) {
  const dirs = listChildDirs(pageDir);
  const found = findEntryCaseInsensitive(dirs, candidates);
  return found ? path.join(pageDir, found) : null;
}

function pickEntityFile(dirPath, entityName, extension) {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const candidates = [
    `${toKebabCase(entityName)}.${extension}`,
    `${toPascalCase(entityName)}.${extension}`,
    `${toCamelCase(entityName)}.${extension}`,
    `${entityName}.${extension}`,
  ];
  const found = findEntryCaseInsensitive(files, candidates);
  return found ? path.join(dirPath, found) : null;
}

function resolveMappedTargets(route) {
  const mapping = ROUTE_MAPPINGS[route.apiPath];
  if (!mapping) return null;

  const pageDir = path.join(frontendPagesDir, mapping.pageDir);
  const modelDir = path.join(pageDir, mapping.modelDir);
  const serviceDir = path.join(pageDir, mapping.serviceDir);

  if (!fs.existsSync(pageDir) && !createMissing) return null;

  if (createMissing) {
    ensureDir(pageDir);
    ensureDir(modelDir);
    ensureDir(serviceDir);
  }

  const modelPath = path.join(modelDir, mapping.modelFile);
  const servicePath = path.join(serviceDir, mapping.serviceFile);

  return {
    pageDir,
    modelPath,
    servicePath,
  };
}

function parseExistingServiceClassName(servicePath, fallbackName) {
  if (!servicePath || !fs.existsSync(servicePath)) {
    return fallbackName;
  }

  const source = fs.readFileSync(servicePath, 'utf8');
  const match = source.match(/export\s+class\s+([A-Za-z0-9_]+)/);
  return match?.[1] ?? fallbackName;
}

function resolveModelImportInfo(modelPath, entityNamePascal) {
  if (!modelPath || !fs.existsSync(modelPath)) {
    return null;
  }

  const source = fs.readFileSync(modelPath, 'utf8');
  const entitySymbol = entityNamePascal;
  const apiItemSymbol = `${entityNamePascal}ApiItem`;
  const paginationSymbol = `${entityNamePascal}PaginationResponse`;

  const hasEntity = new RegExp(`\\b(interface|type)\\s+${entitySymbol}\\b`).test(source);
  const hasApiItem = new RegExp(`\\b(interface|type)\\s+${apiItemSymbol}\\b`).test(source);
  const hasPagination = new RegExp(`\\b(interface|type)\\s+${paginationSymbol}\\b`).test(source);

  if (!hasEntity || !hasApiItem || !hasPagination) {
    return null;
  }

  return {
    entitySymbol,
    apiItemSymbol,
    paginationSymbol,
  };
}

function isGeneratorManagedModel(modelPath) {
  if (!modelPath || !fs.existsSync(modelPath)) {
    return false;
  }

  const source = fs.readFileSync(modelPath, 'utf8');
  return source.includes('Generated from backend mount');
}

function writeFileIfAllowed(filePath, content, overwriteExisting = false) {
  const exists = fs.existsSync(filePath);
  if (exists && !overwriteExisting) {
    return { created: false, skipped: true, overwritten: false };
  }

  if (!dryRun) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return {
    created: !exists,
    skipped: false,
    overwritten: exists,
  };
}

function extractApiModulesFromApp(appSource) {
  const moduleMap = new Map();

  const importRegex =
    /import\s+([A-Za-z0-9_$]+)\s+from\s+['"]\.\/api\/([^'"]+)['"];?/g;
  let importMatch;
  while ((importMatch = importRegex.exec(appSource)) !== null) {
    const variableName = importMatch[1];
    const importPath = importMatch[2].replace(/\.js$/i, '');
    const folderName = importPath.split('/')[0];
    moduleMap.set(variableName, {
      folderName,
      importPath,
    });
  }

  const routes = [];
  const appUseRegex = /app\.use\((['"])\/api\/([^'"]+)\1\s*,\s*([A-Za-z0-9_$]+)\s*\);/g;
  let useMatch;
  while ((useMatch = appUseRegex.exec(appSource)) !== null) {
    const apiPath = useMatch[2];
    const routeVar = useMatch[3];
    const routeMeta = moduleMap.get(routeVar);
    if (!routeMeta) {
      continue;
    }

    const routeFilePath = path.join(backendRoot, 'src', 'api', `${routeMeta.importPath}.js`);

    routes.push({
      apiPath,
      folderName: routeMeta.folderName,
      routeVar,
      routeFilePath,
    });
  }

  return routes;
}

function parseRouteEndpoints(routeSource) {
  const endpoints = [];
  const routeRegex = /router\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/gi;
  let match;

  while ((match = routeRegex.exec(routeSource)) !== null) {
    const method = match[1].toLowerCase();
    const routePath = match[3].trim();

    endpoints.push({
      method,
      routePath,
    });
  }

  const uniqueMap = new Map();
  endpoints.forEach((ep) => {
    uniqueMap.set(`${ep.method}:${ep.routePath}`, ep);
  });

  return Array.from(uniqueMap.values());
}

function getPathParams(routePath) {
  const matches = routePath.match(/:([A-Za-z0-9_]+)/g) ?? [];
  return matches.map((item) => item.slice(1));
}

function buildMethodName(method, routePath) {
  const normalizedPath = routePath === '' ? '/' : routePath;
  const segments = normalizedPath.split('/').filter(Boolean);
  const paramSegments = segments.filter((seg) => seg.startsWith(':')).map((seg) => seg.slice(1));
  const staticSegments = segments.filter((seg) => !seg.startsWith(':'));

  if (normalizedPath === '/') {
    if (method === 'get') return 'getAll';
    if (method === 'post') return 'create';
  }

  if (segments.length === 1 && paramSegments.length === 1) {
    const idPart = toPascalCase(paramSegments[0]);
    if (method === 'get') return `getBy${idPart}`;
    if (method === 'put') return `updateBy${idPart}`;
    if (method === 'patch') return `patchBy${idPart}`;
    if (method === 'delete') return `deleteBy${idPart}`;
  }

  const methodPrefixMap = {
    get: 'get',
    post: 'post',
    put: 'put',
    patch: 'patch',
    delete: 'delete',
  };

  const descriptorParts = [];
  segments.forEach((seg) => {
    if (seg.startsWith(':')) {
      descriptorParts.push(`By${toPascalCase(seg.slice(1))}`);
    } else {
      descriptorParts.push(toPascalCase(seg));
    }
  });

  return toCamelCase(`${methodPrefixMap[method]} ${descriptorParts.join(' ')}`);
}

function buildMethodCode(endpoint) {
  const { method, routePath } = endpoint;
  const methodName = buildMethodName(method, routePath);
  const pathParams = getPathParams(routePath);
  const hasPayload = method === 'post' || method === 'put' || method === 'patch';
  const urlSuffix = routePath === '/' ? '' : routePath.replace(/:([A-Za-z0-9_]+)/g, '${$1}');
  const methodArgs = [];

  pathParams.forEach((paramName) => {
    methodArgs.push(`${paramName}: number | string`);
  });

  if (hasPayload) {
    methodArgs.push('payload: any = {}');
  }

  methodArgs.push('query?: Record<string, string | number | boolean>');

  const httpMethod = method;
  const urlExpr = `\`${'${this.API}'}${urlSuffix}\``;

  if (hasPayload) {
    return `  ${methodName}(${methodArgs.join(', ')}): Observable<any> {
    const params = this.buildHttpParams(query);
    return this.http
      .${httpMethod}<any>(${urlExpr}, payload, { params })
      .pipe(map((res) => res?.data ?? res));
  }
`;
  }

  if (method === 'delete') {
    return `  ${methodName}(${methodArgs.join(', ')}): Observable<any> {
    const params = this.buildHttpParams(query);
    return this.http
      .delete<any>(${urlExpr}, { params })
      .pipe(map((res) => res?.data ?? res));
  }
`;
  }

  return `  ${methodName}(${methodArgs.join(', ')}): Observable<any> {
    const params = this.buildHttpParams(query);
    return this.http
      .get<any>(${urlExpr}, { params })
      .pipe(map((res) => res?.data ?? res));
  }
`;
}

function findEndpoint(endpoints, method, routePath) {
  return endpoints.find((ep) => ep.method === method && ep.routePath === routePath);
}

function findSchemaFileForRoute(route) {
  const apiRoot = path.join(backendRoot, 'src', 'api');
  const candidates = [route.folderName, route.apiPath, route.apiPath.replace(/s$/i, '')]
    .filter(Boolean)
    .map((value) => value.split('/')[0]);

  for (const candidate of candidates) {
    const dirPath = path.join(apiRoot, candidate);
    if (!fs.existsSync(dirPath)) {
      continue;
    }

    const files = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);

    const expected = [
      `${candidate}_schema.js`,
      `${toKebabCase(candidate)}_schema.js`,
      `${toCamelCase(candidate)}_schema.js`,
      `${toPascalCase(candidate)}_schema.js`,
    ];

    const exact = findEntryCaseInsensitive(files, expected);
    if (exact) {
      return path.join(dirPath, exact);
    }

    const fallback = files.find((file) => /schema\.js$/i.test(file));
    if (fallback) {
      return path.join(dirPath, fallback);
    }
  }

  return null;
}

function extractFirstObjectLiteral(source, startIndex) {
  const openIndex = source.indexOf('{', startIndex);
  if (openIndex === -1) return null;

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inTemplate = !inTemplate;
      continue;
    }

    if (inSingle || inDouble || inTemplate) {
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex, i + 1);
      }
    }
  }

  return null;
}

function splitTopLevelEntries(objectLiteral) {
  const body = objectLiteral.trim().replace(/^\{/, '').replace(/\}$/, '');
  const entries = [];

  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  let start = 0;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inTemplate = !inTemplate;
      continue;
    }

    if (inSingle || inDouble || inTemplate) {
      continue;
    }

    if (ch === '(') depthParen += 1;
    if (ch === ')') depthParen -= 1;
    if (ch === '{') depthBrace += 1;
    if (ch === '}') depthBrace -= 1;
    if (ch === '[') depthBracket += 1;
    if (ch === ']') depthBracket -= 1;

    if (ch === ',' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
      const item = body.slice(start, i).trim();
      if (item) entries.push(item);
      start = i + 1;
    }
  }

  const last = body.slice(start).trim();
  if (last) entries.push(last);

  return entries;
}

function mapSequelizeTypeToTs(typeToken) {
  const token = (typeToken ?? '').toUpperCase();

  if (/^(INTEGER|BIGINT|FLOAT|DOUBLE|REAL|DECIMAL|SMALLINT|MEDIUMINT)$/.test(token)) {
    return 'number';
  }

  if (/^(BOOLEAN)$/.test(token)) {
    return 'boolean';
  }

  if (/^(DATE|DATEONLY|TIME)$/.test(token)) {
    return 'string';
  }

  if (/^(JSON|JSONB)$/.test(token)) {
    return 'Record<string, any> | any[]';
  }

  if (/^(TEXT|STRING|CHAR|UUID|ENUM|CIDR|INET|MACADDR)$/.test(token)) {
    return 'string';
  }

  return 'any';
}

function parseSchemaFields(schemaSource) {
  const defineIndex = schemaSource.indexOf('sequelize.define');
  if (defineIndex === -1) {
    return [];
  }

  const argsStart = schemaSource.indexOf('(', defineIndex);
  if (argsStart === -1) {
    return [];
  }

  const firstObjectIndex = schemaSource.indexOf('{', argsStart);
  if (firstObjectIndex === -1) {
    return [];
  }

  const attributesLiteral = extractFirstObjectLiteral(schemaSource, firstObjectIndex);
  if (!attributesLiteral) {
    return [];
  }

  const entries = splitTopLevelEntries(attributesLiteral);
  const fields = [];

  entries.forEach((entry) => {
    const fieldMatch = entry.match(/^([A-Za-z0-9_]+)\s*:\s*(\{[\s\S]*\})$/);
    if (!fieldMatch) {
      return;
    }

    const fieldName = fieldMatch[1];
    const fieldBlock = fieldMatch[2];

    const typeMatch = fieldBlock.match(/type\s*:\s*DataTypes\.([A-Za-z0-9_]+)/);
    const allowNullMatch = fieldBlock.match(/allowNull\s*:\s*(true|false)/i);
    const requiredByPrimaryKey = /primaryKey\s*:\s*true/i.test(fieldBlock);

    const tsType = mapSequelizeTypeToTs(typeMatch?.[1]);
    const allowNull = allowNullMatch ? allowNullMatch[1].toLowerCase() === 'true' : true;

    fields.push({
      name: fieldName,
      type: allowNull ? `${tsType} | null` : tsType,
      optional: !requiredByPrimaryKey,
    });
  });

  return fields;
}

function buildPatientLegacyEndpointMethods() {
  return `  // Legacy endpoint compatibility mode for patient module
  getPatients(
    page: number = 1,
    limit: number = 10,
    filters?: Record<string, any>,
  ): Observable<PatientPaginationResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      });
    }

    return this.http
      .get<any>(\`${'${this.API}'}/get-all-patients\`, { params })
      .pipe(
        map((res) => ({
          patients: res?.data?.patients ?? [],
          items: res?.data?.patients ?? [],
          total: res?.data?.total ?? 0,
          page: res?.data?.page ?? 1,
          totalPages: res?.data?.totalPages ?? 1,
          limit: res?.data?.limit ?? 10,
        })),
      );
  }

  getPatientById(id: number | string): Observable<PatientApiItem> {
    return this.http
      .get<any>(\`${'${this.API}'}/\${id}\`)
      .pipe(map((res) => (res?.data ?? res) as PatientApiItem));
  }

  createPatient(data: Partial<Patient> | FormData): Observable<Patient> {
    return this.http
      .post<any>(\`${'${this.API}'}\`, data)
      .pipe(map((res) => (res?.data ?? res) as Patient));
  }

  updatePatient(id: number | string, data: Partial<Patient> | FormData): Observable<Patient> {
    return this.http
      .put<any>(\`${'${this.API}'}/\${id}\`, data)
      .pipe(map((res) => (res?.data ?? res) as Patient));
  }

  getPatientStats(): Observable<any> {
    return this.http.get<any>(\`${'${this.API}'}/stats\`);
  }

  deletePatient(id: number | string): Observable<any> {
    return this.http.delete<any>(\`${'${this.API}'}/\${id}\`);
  }

  deletePatients(ids: number[]): Observable<any> {
    return this.http.post<any>(\`${'${this.API}'}/bulk-delete\`, { ids });
  }

  updatePatientStatus(id: number | string, isActive: boolean): Observable<any> {
    return this.http.patch<any>(
      \`${'${this.API}'}/\${id}/\${isActive ? 'activate' : 'deactivate'}\`,
      {},
    );
  }
`;
}

function buildLegacyAliases(entityNamePascal, endpoints, options = {}) {
  if (!options.enableLegacy) {
    return '';
  }

  const pluralPascal = pluralize(entityNamePascal);
  const pluralCamel = toCamelCase(pluralPascal);

  if (options.legacyEndpoints && entityNamePascal === 'Patient') {
    return buildPatientLegacyEndpointMethods();
  }

  const hasGetAll = !!findEndpoint(endpoints, 'get', '/');
  const hasCreate = !!findEndpoint(endpoints, 'post', '/');
  const idGetEp = endpoints.find((ep) => ep.method === 'get' && /^\/:\w+$/.test(ep.routePath));
  const idPutEp = endpoints.find((ep) => ep.method === 'put' && /^\/:\w+$/.test(ep.routePath));
  const idDeleteEp = endpoints.find((ep) => ep.method === 'delete' && /^\/:\w+$/.test(ep.routePath));
  const hasStats = !!findEndpoint(endpoints, 'get', '/stats');
  const hasBulkDelete = !!findEndpoint(endpoints, 'post', '/bulk-delete');
  const hasActivate = endpoints.some((ep) => ep.method === 'patch' && /\/activate$/.test(ep.routePath));
  const hasDeactivate = endpoints.some((ep) => ep.method === 'patch' && /\/deactivate$/.test(ep.routePath));

  const aliases = [];

  if (hasGetAll) {
    aliases.push(`  get${pluralPascal}(
    page: number = 1,
    limit: number = 10,
    filters?: Record<string, any>,
  ): Observable<${entityNamePascal}PaginationResponse> {
    const query = { page, limit, ...(filters ?? {}) };
    return this.getAll(query).pipe(
      map((data: any) => ({
        ${pluralCamel}: data?.${pluralCamel} ?? data?.items ?? [],
        items: data?.items ?? data?.${pluralCamel} ?? [],
        total: data?.total ?? 0,
        page: data?.page ?? page,
        totalPages: data?.totalPages ?? 1,
        limit: data?.limit ?? limit,
      })),
    );
  }
`);
  }

  if (idGetEp) {
    const methodName = buildMethodName('get', idGetEp.routePath);
    aliases.push(`  get${entityNamePascal}ById(id: number | string): Observable<${entityNamePascal}ApiItem> {
    return this.${methodName}(id).pipe(
      map((res) => res as ${entityNamePascal}ApiItem),
    );
  }
`);
  }

  if (hasCreate) {
    aliases.push(`  create${entityNamePascal}(data: Partial<${entityNamePascal}> | FormData): Observable<${entityNamePascal}> {
    return this.create(data).pipe(map((res) => res as ${entityNamePascal}));
  }
`);
  }

  if (idPutEp) {
    const methodName = buildMethodName('put', idPutEp.routePath);
    aliases.push(`  update${entityNamePascal}(id: number | string, data: Partial<${entityNamePascal}> | FormData): Observable<${entityNamePascal}> {
    return this.${methodName}(id, data).pipe(map((res) => res as ${entityNamePascal}));
  }
`);
  }

  if (hasStats) {
    aliases.push(`  get${entityNamePascal}Stats(query?: Record<string, string | number | boolean>): Observable<any> {
    return this.getStats(query);
  }
`);
  }

  if (idDeleteEp) {
    const methodName = buildMethodName('delete', idDeleteEp.routePath);
    aliases.push(`  delete${entityNamePascal}(id: number | string): Observable<any> {
    return this.${methodName}(id);
  }
`);
  }

  if (hasBulkDelete) {
    aliases.push(`  delete${pluralPascal}(ids: number[]): Observable<any> {
    return this.postBulkDelete({ ids });
  }
`);
  }

  if (entityNamePascal === 'Patient') {
    aliases.push(`  updatePatientStatus(id: number | string, isActive: boolean): Observable<any> {
    return this.http.patch<any>(
      \`${'${this.API}'}/\${id}/\${isActive ? 'activate' : 'deactivate'}\`,
      {},
    );
  }
`);
  }

  if (entityNamePascal !== 'Patient' && hasActivate && hasDeactivate) {
    const activate = endpoints.find((ep) => ep.method === 'patch' && /\/activate$/.test(ep.routePath));
    const deactivate = endpoints.find((ep) => ep.method === 'patch' && /\/deactivate$/.test(ep.routePath));
    const activateMethod = activate ? buildMethodName('patch', activate.routePath) : null;
    const deactivateMethod = deactivate ? buildMethodName('patch', deactivate.routePath) : null;

    if (activateMethod && deactivateMethod) {
      aliases.push(`  update${entityNamePascal}Status(id: number | string, isActive: boolean): Observable<any> {
    return isActive ? this.${activateMethod}(id, {}) : this.${deactivateMethod}(id, {});
  }
`);
    }
  }

  return aliases.join('\n');
}

function buildModelContent(entityNamePascal, endpointPath, schemaFields = []) {
  const entityName = entityNamePascal;
  const pluralCamel = toCamelCase(pluralize(entityNamePascal));
  const fieldLines = schemaFields.length
    ? schemaFields
        .map((field) => `  ${field.name}${field.optional ? '?' : ''}: ${field.type};`)
        .join('\n')
    : `  id: number;\n  is_active?: boolean;\n  created_at?: string;\n  updated_at?: string | null;`;

  return `export interface ${entityName} {
${fieldLines}
}

export type ${entityName}ApiItem = ${entityName};

export interface ${entityName}PaginationResponse {
  ${pluralCamel}?: ${entityName}[];
  items: ${entityName}[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface ${entityName}ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export type ${entityName}Query = Record<string, string | number | boolean>;

// Generated from backend mount: /api/${endpointPath}
`;
}

function buildServiceContent(
  entityNamePascal,
  endpointPath,
  endpoints,
  modelImportPath,
  modelImportInfo,
  className,
) {
  const generatedMethods = endpoints.map((ep) => buildMethodCode(ep)).join('\n');
  const legacyAliases = buildLegacyAliases(entityNamePascal, endpoints, {
    legacyEndpoints,
    enableLegacy: !!modelImportInfo,
  });

  const modelImports = modelImportPath
    ? `import {
  ${modelImportInfo.entitySymbol},
  ${modelImportInfo.apiItemSymbol},
  ${modelImportInfo.paginationSymbol},
} from '${modelImportPath}';\n`
    : '';

  return `import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
${modelImports}import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ${className} {
  private http = inject(HttpClient);

  private readonly API = \`${'${environment.apiUrl}'}/api/${endpointPath}\`;

  private buildHttpParams(
    query?: Record<string, string | number | boolean>,
  ): HttpParams {
    let params = new HttpParams();
    if (!query) {
      return params;
    }

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return params;
  }

${generatedMethods}

${legacyAliases}
}
`;
}

function main() {
  if (!fs.existsSync(appFile)) {
    throw new Error(`Cannot find backend app file: ${appFile}`);
  }

  if (!fs.existsSync(frontendPagesDir)) {
    throw new Error(`Cannot find frontend pages directory: ${frontendPagesDir}`);
  }

  const appSource = fs.readFileSync(appFile, 'utf8');
  const routes = extractApiModulesFromApp(appSource);

  const entityFilter = entitiesArg
    ? new Set(
        entitiesArg
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => item.toLowerCase()),
      )
    : null;

  const generatedRows = [];
  let createdCount = 0;
  let overwrittenCount = 0;
  let skippedCount = 0;
  const touchedModels = new Set();
  const touchedServices = new Set();

  routes.forEach((route) => {
    const key = route.folderName.toLowerCase();
    if (entityFilter && !entityFilter.has(key) && !entityFilter.has(route.apiPath.toLowerCase())) {
      return;
    }

    if (!fs.existsSync(route.routeFilePath)) {
      return;
    }

    const mappedTargets = resolveMappedTargets(route);

    const pageDir = mappedTargets?.pageDir ?? findExistingPageDir(route.folderName);
    if (!pageDir && !createMissing) {
      return;
    }

    const targetPageDir = pageDir ?? path.join(frontendPagesDir, toPascalCase(route.folderName));
    if (createMissing) {
      ensureDir(targetPageDir);
    }

    const modelDir = mappedTargets
      ? path.dirname(mappedTargets.modelPath)
      : pickExistingSubDir(targetPageDir, ['model', 'models'])
        ?? (createMissing ? path.join(targetPageDir, 'models') : null);
    const serviceDir = mappedTargets
      ? path.dirname(mappedTargets.servicePath)
      : pickExistingSubDir(targetPageDir, ['service', 'services'])
        ?? (createMissing ? path.join(targetPageDir, 'service') : null);

    if (createMissing && modelDir) ensureDir(modelDir);
    if (createMissing && serviceDir) ensureDir(serviceDir);

    const modelPath = mappedTargets?.modelPath
      ?? pickEntityFile(modelDir, route.folderName, 'model.ts')
      ?? (createMissing && modelDir ? path.join(modelDir, `${toKebabCase(route.folderName)}.model.ts`) : null);
    const servicePath = mappedTargets?.servicePath
      ?? pickEntityFile(serviceDir, route.folderName, 'service.ts')
      ?? (createMissing && serviceDir ? path.join(serviceDir, `${toKebabCase(route.folderName)}.service.ts`) : null);

    const routeSource = fs.readFileSync(route.routeFilePath, 'utf8');
    const endpoints = parseRouteEndpoints(routeSource);
    const schemaFilePath = findSchemaFileForRoute(route);
    const schemaFields = schemaFilePath
      ? parseSchemaFields(fs.readFileSync(schemaFilePath, 'utf8'))
      : [];

    const canWriteModel = !!modelPath && !touchedModels.has(modelPath);
    if (canWriteModel && modelPath) {
      touchedModels.add(modelPath);

      const overwriteModel = forceModels && isGeneratorManagedModel(modelPath);

      const modelResult = writeFileIfAllowed(
        modelPath,
        buildModelContent(toPascalCase(route.folderName), route.apiPath, schemaFields),
        overwriteModel,
      );

      if (modelResult.skipped) {
        skippedCount += 1;
      } else if (modelResult.overwritten) {
        overwrittenCount += 1;
      } else if (modelResult.created) {
        createdCount += 1;
      }

      generatedRows.push({
        entity: route.folderName,
        type: 'model',
        file: path.relative(process.cwd(), modelPath),
        action: modelResult.skipped ? 'skipped' : modelResult.overwritten ? 'overwritten' : 'created',
      });
    }

    const canWriteService = !!servicePath && !touchedServices.has(servicePath);
    if (canWriteService && servicePath) {
      touchedServices.add(servicePath);

      const entityNamePascal = toPascalCase(route.folderName);
      const importPath = modelPath
        ? `../${path.basename(path.dirname(modelPath))}/${path.basename(modelPath, '.ts')}`
        : null;
      const modelImportInfo = modelPath
        ? resolveModelImportInfo(modelPath, entityNamePascal)
        : null;
      const className = parseExistingServiceClassName(
        servicePath,
        `${entityNamePascal}Service`,
      );
      const serviceResult = writeFileIfAllowed(
        servicePath,
        buildServiceContent(
          entityNamePascal,
          route.apiPath,
          endpoints,
          modelImportInfo ? importPath : null,
          modelImportInfo,
          className,
        ),
        forceServices,
      );

      if (serviceResult.skipped) {
        skippedCount += 1;
      } else if (serviceResult.overwritten) {
        overwrittenCount += 1;
      } else if (serviceResult.created) {
        createdCount += 1;
      }

      generatedRows.push({
        entity: route.folderName,
        type: 'service',
        file: path.relative(process.cwd(), servicePath),
        action: serviceResult.skipped ? 'skipped' : serviceResult.overwritten ? 'overwritten' : 'created',
      });
    }
  });

  console.log(`Frontend root: ${frontendRoot}`);
  console.log(
    `Mode: ${dryRun ? 'dry-run' : 'write'}${
      forceServices ? ', force-services' : ''
    }${forceModels ? ', force-models' : ''}${legacyEndpoints ? ', legacy-endpoints' : ''}${
      createMissing ? ', create-missing' : ''
    }`,
  );
  console.log('');

  if (generatedRows.length === 0) {
    console.log('No matching API modules found for generation.');
    return;
  }

  generatedRows.forEach((row) => {
    console.log(`[${row.action}] ${row.entity} ${row.type} -> ${row.file}`);
  });

  console.log('');
  console.log(
    `Summary: created=${createdCount}, overwritten=${overwrittenCount}, skipped=${skippedCount}, total=${generatedRows.length}`,
  );
}

main();