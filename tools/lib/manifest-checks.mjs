/**
 * Contrôles métier du manifeste Forge de Banc (§19, §21, §22, §24).
 *
 * Bibliothèque pure : elle reçoit le manifeste déjà parsé et un rapport, et
 * n'écrit rien. `tools/check-manifest.mjs` l'appelle et décide du code de
 * sortie.
 *
 * Le contrat vérifié ici est celui du cahier des charges de Banc : les douze
 * outils MCP du §19, les seize tables du §22, la limite de cinq déclencheurs
 * planifiés avec un seul à 5 minutes (§21, §24), et l'absence de chargement
 * distant dans les interfaces (§21).
 */

/** Les douze outils du §19, dans l'ordre du cahier des charges : [clé, verbe]. */
export const EXPECTED_ACTIONS = [
  ['run-bench', 'CREATE'],
  ['get-scorecard', 'GET'],
  ['list-regressions', 'GET'],
  ['compare-versions', 'GET'],
  ['get-case', 'GET'],
  ['list-cases', 'GET'],
  ['check-promotion', 'GET'],
  ['get-stability', 'GET'],
  ['get-oracle-health', 'GET'],
  ['propose-case', 'CREATE'],
  ['record-judgment', 'CREATE'],
  ['get-run-log', 'GET'],
];

/** Les seize tables du §22. */
export const EXPECTED_TABLES = [
  'agent', 'agent_version', 'case', 'oracle_state', 'condition', 'suite', 'run', 'pass',
  'verdict', 'scorecard', 'regression', 'fissure', 'judgment', 'calibration', 'amorce', 'budget',
];

/** Les dix-huit modules déclarés par le banc. */
export const EXPECTED_MODULES = [
  'rovo:mcp', 'rovo:agent', 'rovo:skill', 'action', 'jira:globalPage', 'jira:projectPage',
  'jira:issuePanel', 'jira:workflowValidator', 'jira:customField', 'jira:dashboardGadget',
  'confluence:globalPage', 'confluence:spaceSettingsPage', 'trigger', 'scheduledTrigger',
  'consumer', 'webtrigger', 'sql', 'llm',
];

/** Un rapport de contrôle : erreurs et notices. */
export function createReport() {
  const errors = [];
  const notices = [];
  return {
    errors,
    notices,
    fail(scope, message) { errors.push({ scope, message }); return false; },
    note(scope, message) { notices.push({ scope, message }); },
    ok() { return errors.length === 0; },
  };
}

/** Vérifie une condition, et journalise l'échec si elle n'est pas remplie. */
export function expect(condition, scope, message, report) {
  if (!condition) report.fail(scope, message);
  return Boolean(condition);
}

/** Vérifie que les clés de modules attendues sont toutes là (§21). */
export function checkModuleKeys(modules, report) {
  const present = Object.keys(modules ?? {});
  for (const key of EXPECTED_MODULES) {
    expect(present.includes(key), 'modules', `module « ${key} » absent`, report);
  }
  for (const key of present) {
    if (!EXPECTED_MODULES.includes(key)) {
      report.note('modules', `module « ${key} » hors du périmètre du banc`);
    }
  }
  return present;
}

/** Vérifie le bloc `app` : UUID v4, nom, runtime, compatibilité. */
export function checkApp(app, report) {
  const id = String(app?.id ?? '');
  const uuid = /ari:cloud:ecosystem::app\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  expect(uuid.test(id), 'app.id', 'app.id doit être un ARI suivi d’un UUID v4', report);
  expect(typeof app?.name === 'string' && app.name.length > 0, 'app.name', 'nom obligatoire', report);
  expect(app?.runtime?.name === 'nodejs22.x', 'app.runtime.name', 'runtime attendu : nodejs22.x', report);
  expect(Number(app?.runtime?.memoryMB) <= 1024, 'app.runtime.memoryMB', 'mémoire au-delà de 1 Go', report);
  expect(app?.compatibility?.jira?.required === true, 'app.compatibility.jira', 'Jira doit être requis', report);
  return true;
}

/** Vérifie les douze actions : présence, verbe, et clé unique. */
export function checkActions(modules, report) {
  const actions = Array.isArray(modules?.action) ? modules.action : [];
  const keys = actions.map((entry) => entry?.key);
  for (const [key, verb] of EXPECTED_ACTIONS) {
    const entry = actions.find((item) => item?.key === key);
    if (!expect(entry, 'modules.action', `action « ${key} » manquante (§19)`, report)) continue;
    expect(typeof entry?.function === 'string' && entry.function.length > 0,
      `modules.action.${key}`, 'function obligatoire', report);
    const declared = entry?.actionVerb;
    if (declared !== undefined) {
      expect(declared === verb, `modules.action.${key}`,
        `actionVerb doit valoir ${verb} (§19), trouvé « ${declared} »`, report);
    }
  }
  for (const key of keys) {
    if (key && !EXPECTED_ACTIONS.some(([expected]) => expected === key)) {
      report.fail('modules.action', `action « ${key} » hors de la liste des douze outils du §19`);
    }
  }
  expect(new Set(keys).size === keys.length, 'modules.action', 'clé d’action dupliquée', report);
  return actions;
}

/**
 * Vérifie le bloc `rovo:mcp` : un seul module par app (§24), les douze outils,
 * chacun rattaché à une action déclarée.
 */
export function checkRovo(modules, report) {
  const actionKeys = new Set((modules?.action ?? []).map((entry) => entry?.key));
  const mcpList = Array.isArray(modules?.['rovo:mcp']) ? modules['rovo:mcp'] : [];
  if (!expect(mcpList.length === 1, 'modules.rovo:mcp', 'un seul module rovo:mcp par app (§24)', report)) return;
  const mcp = mcpList[0];
  expect(typeof mcp?.name === 'string' && mcp.name.length <= 30,
    'modules.rovo:mcp', 'name obligatoire (30 caractères max)', report);
  const tools = Array.isArray(mcp?.tools) ? mcp.tools : [];
  const toolKeys = tools.map((tool) => tool?.key);
  for (const tool of tools) {
    const scope = `modules.rovo:mcp.tools.${tool?.key ?? '?'}`;
    expect(typeof tool?.name === 'string' && tool.name.length > 0, scope, 'name obligatoire', report);
    expect(typeof tool?.description === 'string' && tool.description.length > 0, scope, 'description obligatoire', report);
    expect(actionKeys.has(tool?.action), scope, `outil sans action déclarée (« ${tool?.action} » ?)`, report);
  }
  for (const [key] of EXPECTED_ACTIONS) {
    expect(toolKeys.includes(key), 'modules.rovo:mcp.tools', `outil « ${key} » absent (§19)`, report);
  }
  expect(new Set(toolKeys).size === toolKeys.length, 'modules.rovo:mcp.tools', 'clé d’outil dupliquée', report);
  checkAgent(modules, actionKeys, report);
  checkSkill(modules, report);
}

/** Vérifie l'agent Rovo « Le jury » : ses actions doivent exister (§19). */
export function checkAgent(modules, actionKeys, report) {
  const agents = Array.isArray(modules?.['rovo:agent']) ? modules['rovo:agent'] : [];
  expect(agents.length === 1, 'modules.rovo:agent', 'un agent « Le jury » attendu (§19)', report);
  for (const agent of agents) {
    const scope = `modules.rovo:agent.${agent?.key ?? '?'}`;
    expect(typeof agent?.name === 'string' && agent.name.length <= 30, scope, 'name obligatoire', report);
    expect(typeof agent?.prompt === 'string' && agent.prompt !== '', scope, 'prompt obligatoire', report);
    for (const action of agent?.actions ?? []) {
      expect(actionKeys.has(action), `${scope}.actions`, `action « ${action} » non déclarée`, report);
    }
  }
}

/** Vérifie la skill : elle doit pointer un fichier réel (§19). */
export function checkSkill(modules, report) {
  const skills = Array.isArray(modules?.['rovo:skill']) ? modules['rovo:skill'] : [];
  expect(skills.length >= 1, 'modules.rovo:skill', 'la skill before-promoting-an-agent est attendue (§19)', report);
  for (const skill of skills) {
    const scope = `modules.rovo:skill.${skill?.key ?? '?'}`;
    expect(typeof skill?.name === 'string' && skill.name.length > 0, scope, 'name obligatoire', report);
    expect(typeof skill?.resource === 'string' && skill.resource.length > 0, scope, 'resource obligatoire', report);
  }
}

/** Vérifie le schéma SQL : les seize tables du §22, uniques. */
export function checkSql(modules, report) {
  const sql = Array.isArray(modules?.sql) ? modules.sql[0] : modules?.sql;
  const tables = Array.isArray(sql?.tables) ? sql.tables : [];
  const names = tables.map((table) => table?.name);
  expect(names.length === EXPECTED_TABLES.length, 'modules.sql',
    `le schéma doit déclarer ${EXPECTED_TABLES.length} tables (§22), trouvé ${names.length}`, report);
  for (const name of EXPECTED_TABLES) {
    expect(names.includes(name), 'modules.sql.tables', `table « ${name} » absente (§22)`, report);
  }
  expect(new Set(names).size === names.length, 'modules.sql.tables', 'table dupliquée', report);
}

/**
 * Vérifie les déclencheurs planifiés : cinq au plus, UN SEUL à 5 minutes
 * (§21, §24). C'est une limite de plateforme, pas une préférence.
 */
export function checkTriggers(modules, report) {
  const scheduled = Array.isArray(modules?.scheduledTrigger) ? modules.scheduledTrigger : [];
  expect(scheduled.length <= 5, 'modules.scheduledTrigger',
    `cinq déclencheurs planifiés au plus (§21), trouvé ${scheduled.length}`, report);
  const fast = scheduled.filter((entry) => parseInterval(entry?.interval) <= 5);
  expect(fast.length <= 1, 'modules.scheduledTrigger',
    `un seul déclencheur planifié à 5 minutes (§21), trouvé ${fast.length}`, report);
  for (const entry of scheduled) {
    expect(typeof entry?.function === 'string' && entry.function.length > 0,
      `modules.scheduledTrigger.${entry?.key ?? '?'}`, 'function obligatoire', report);
  }
}

/** Convertit un intervalle (`5m`, `1d`, `1w`) en minutes. */
export function parseInterval(interval) {
  const match = /^(\d+)([mhdw])$/.exec(String(interval ?? ''));
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === 'm') return value;
  if (unit === 'h') return value * 60;
  if (unit === 'd') return value * 1440;
  return value * 10080;
}

/** Vérifie les permissions : scopes déclarés, et AUCUN chargement distant (§21). */
export function checkPermissions(permissions, report) {
  const scopes = Array.isArray(permissions?.scopes) ? permissions.scopes : [];
  expect(scopes.length > 0, 'permissions.scopes', 'au moins un scope déclaré', report);
  expect(new Set(scopes).size === scopes.length, 'permissions.scopes', 'scope dupliqué', report);
  const images = permissions?.external?.images;
  expect(Array.isArray(images) && images.length === 0, 'permissions.external.images',
    'aucun chargement distant dans les interfaces (§21)', report);
}

/** Vérifie les ressources : la ressource principale et l'icône. */
export function checkResources(resources, report) {
  const list = Array.isArray(resources) ? resources : [];
  const keys = list.map((resource) => resource?.key);
  expect(keys.includes('main'), 'resources', 'ressource « main » absente', report);
  expect(new Set(keys).size === keys.length, 'resources', 'clé de ressource dupliquée', report);
  for (const resource of list) {
    expect(typeof resource?.path === 'string' && resource.path.length > 0,
      `resources.${resource?.key ?? '?'}`, 'path obligatoire', report);
  }
}

/** Vérifie que chaque `function:` référencée existe dans l'arborescence. */
export function checkFunctionReferences(modules, resources, exists, report) {
  const referenced = [];
  for (const list of Object.values(modules ?? {})) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry?.function === 'string') referenced.push(entry.function);
      if (typeof entry?.resolver?.function === 'string') referenced.push(entry.resolver.function);
    }
  }
  for (const resource of resources ?? []) {
    if (typeof resource?.path === 'string') referenced.push(resource.path);
  }
  for (const name of new Set(referenced)) {
    expect(exists(name), 'references', `« ${name} » référencé mais absent de l’arborescence`, report);
  }
}
