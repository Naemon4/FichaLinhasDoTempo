/*
 * DOMÍNIO — regras da ficha, das macros e dos dados.
 * Não conhece DOM nem armazenamento: recebe dados, devolve dados.
 * As funções de comando alteram o `state` recebido (chamadas só pela store).
 */
(function (Ficha) {
  'use strict';

  const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];
  const FIELD_KINDS = { text: 'Texto', number: 'Número', resource: 'Recurso (atual / máx.)', textarea: 'Texto longo' };
  const SECTION_STYLES = { cards: 'Cartões', big: 'Destaque', list: 'Lista' };
  const LIMITS = { count: [1, 100], sides: [2, 1000], bonus: [-9999, 9999] };
  const HISTORY_SIZE = 50;
  const MAX_EXTRA_DICE = 10;

  const ATTRIBUTES = ['Força', 'Agilidade', 'Vigor', 'Intelecto', 'Sabedoria', 'Carisma'];
  const SKILLS = [
    'Acrobacia', 'Adestrar', 'Arcanismo', 'Atletismo', 'Atuação', 'Enganação', 'Fortitude',
    'Furtividade', 'História', 'Intimidação', 'Intuição', 'Investigação', 'Luta', 'Medicina',
    'Natureza', 'Percepção', 'Persuasão', 'Pontaria', 'Prestidigitação', 'Reflexo', 'Religião',
    'Sobrevivência', 'Vontade',
  ];

  /* ---------- Utilitários ---------- */
  const hasKey = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const isObject = value => value !== null && typeof value === 'object';
  const newId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const toNumber = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const clampInt = (value, [min, max]) => Math.min(max, Math.max(min, Math.trunc(toNumber(value))));
  const isNumericField = field => field.kind === 'number' || field.kind === 'resource';
  const sum = list => list.reduce((total, n) => total + n, 0);

  /* ---------- Fábricas ---------- */
  function createField(label, kind = 'text') {
    const field = { id: newId(), label, kind, value: isNumericField({ kind }) ? 0 : '' };
    if (kind === 'resource') field.max = 0;
    return field;
  }

  function createSection(title, style = 'cards', fields = []) {
    return { id: newId(), title, style, fields };
  }

  function createDefaultState() {
    const attributes = ATTRIBUTES.map(name => createField(name, 'number'));
    const skills = SKILLS.map(name => createField(name, 'number'));
    const fight = skills.find(skill => skill.label === 'Luta');

    return {
      sections: [
        createSection('Personagem', 'cards', ['Nome', 'Raça', 'Classe'].map(name => createField(name))),
        createSection('Atributos', 'big', attributes),
        createSection('Perícias', 'list', skills),
        createSection('Status', 'cards', [
          ...['Vida', 'Energia', 'Sanidade'].map(name => createField(name, 'resource')),
          createField('Liberação de Energia', 'number'),
        ]),
        createSection('Habilidades', 'cards', [createField('Habs', 'textarea')]),
      ],
      macros: [normalizeMacro({
        name: 'Teste de Luta', countField: attributes[0].id, sides: 20, bonusField: fight.id, mode: 'max',
      })],
      roller: normalizeRollSpec({}),
      history: [],
    };
  }

  /* ---------- Validação de dados carregados / importados ---------- */
  function normalizeRollSpec(spec = {}) {
    return {
      count: clampInt(spec.count ?? 1, LIMITS.count),
      sides: clampInt(spec.sides ?? 20, LIMITS.sides),
      bonus: clampInt(spec.bonus ?? 0, LIMITS.bonus),
      mode: spec.mode === 'max' ? 'max' : 'sum',
    };
  }

  /** Dados de bônus: [{ count, sides }] — sempre somados ao resultado. */
  function normalizeExtraDice(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(isObject).slice(0, MAX_EXTRA_DICE).map(term => ({
      count: clampInt(term.count ?? 1, LIMITS.count),
      sides: clampInt(term.sides ?? 6, LIMITS.sides),
    }));
  }

  function normalizeField(raw) {
    const kind = hasKey(FIELD_KINDS, raw.kind) ? raw.kind : 'text';
    const field = {
      id: String(raw.id || newId()),
      label: String(raw.label ?? ''),
      kind,
      value: isNumericField({ kind }) ? toNumber(raw.value) : String(raw.value ?? ''),
    };
    if (kind === 'resource') field.max = toNumber(raw.max);
    return field;
  }

  function normalizeSection(raw) {
    const fields = raw.fields || raw.items || []; // "items" = formato da primeira versão
    return {
      id: String(raw.id || newId()),
      title: String(raw.title ?? ''),
      style: hasKey(SECTION_STYLES, raw.style) ? raw.style : 'cards',
      fields: Array.isArray(fields) ? fields.filter(isObject).map(normalizeField) : [],
    };
  }

  /** `validFieldIds` (opcional) descarta referências a campos que não existem. */
  function normalizeMacro(raw, validFieldIds) {
    const ref = id => (id && (!validFieldIds || validFieldIds.has(id)) ? String(id) : null);
    return {
      id: String(raw.id || newId()),
      name: String(raw.name ?? '').trim(),
      countField: ref(raw.countField),
      bonusField: ref(raw.bonusField),
      extraDice: normalizeExtraDice(raw.extraDice),
      ...normalizeRollSpec(raw),
    };
  }

  /** Devolve um estado válido ou `null` se `raw` não for uma ficha. */
  function normalizeState(raw) {
    if (!isObject(raw) || !Array.isArray(raw.sections)) return null;
    const sections = raw.sections.filter(isObject).map(normalizeSection);
    const fieldIds = new Set(sections.flatMap(section => section.fields.map(field => field.id)));
    const list = value => (Array.isArray(value) ? value.filter(isObject) : []);
    return {
      sections,
      macros: list(raw.macros).map(macro => normalizeMacro(macro, fieldIds)),
      roller: normalizeRollSpec(raw.roller),
      history: list(raw.history).filter(entry => Array.isArray(entry.dice)).slice(0, HISTORY_SIZE),
    };
  }

  /* ---------- Consultas ---------- */
  const allFields = state => state.sections.flatMap(section => section.fields);
  const findField = (state, id) => (id && allFields(state).find(field => field.id === id)) || null;
  const findSection = (state, id) => state.sections.find(section => section.id === id) || null;
  const sectionOfField = (state, id) => state.sections.find(section => section.fields.some(field => field.id === id)) || null;
  const fieldNumber = field => (field ? toNumber(field.value) : 0);

  function resourcePercent(field) {
    const max = toNumber(field.max);
    return max > 0 ? Math.min(1, Math.max(0, toNumber(field.value) / max)) * 100 : 0;
  }

  /* ---------- Comandos da ficha ---------- */
  function addSection(state) {
    const section = createSection('Nova seção');
    state.sections.push(section);
    return section;
  }

  function removeSection(state, id) {
    const section = findSection(state, id);
    if (!section) return;
    state.sections = state.sections.filter(s => s !== section);
    forgetFieldsInMacros(state, section.fields.map(field => field.id));
  }

  function addField(state, sectionId, kind) {
    const section = findSection(state, sectionId);
    if (!section || !hasKey(FIELD_KINDS, kind)) return null;
    const field = createField('Novo campo', kind);
    section.fields.push(field);
    return field;
  }

  function removeField(state, id) {
    const section = sectionOfField(state, id);
    if (!section) return;
    section.fields = section.fields.filter(field => field.id !== id);
    forgetFieldsInMacros(state, [id]);
  }

  function forgetFieldsInMacros(state, ids) {
    const removed = new Set(ids);
    for (const macro of state.macros) {
      if (removed.has(macro.countField)) macro.countField = null;
      if (removed.has(macro.bonusField)) macro.bonusField = null;
    }
  }

  function swap(list, index, delta) {
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) return false;
    [list[index], list[target]] = [list[target], list[index]];
    return true;
  }

  const moveSection = (state, id, delta) => swap(state.sections, state.sections.findIndex(s => s.id === id), delta);

  function moveField(state, id, delta) {
    const section = sectionOfField(state, id);
    return Boolean(section) && swap(section.fields, section.fields.findIndex(f => f.id === id), delta);
  }

  /** Aplica uma nova ordem completa: [{ id: idDaSeção, fieldIds: [...] }]. */
  function applyOrder(state, order) {
    const sections = new Map(state.sections.map(section => [section.id, section]));
    const fields = new Map(allFields(state).map(field => [field.id, field]));
    const orderedFieldIds = order.flatMap(entry => entry.fieldIds);
    const isComplete = order.length === sections.size
      && order.every(entry => sections.has(entry.id))
      && orderedFieldIds.length === fields.size
      && orderedFieldIds.every(id => fields.has(id));
    if (!isComplete) return false;

    state.sections = order.map(entry => Object.assign(sections.get(entry.id), {
      fields: entry.fieldIds.map(id => fields.get(id)),
    }));
    return true;
  }

  /* ---------- Dados ---------- */
  /** Inteiro aleatório de 1 a `max`, sem viés de módulo. */
  function randomInt(max) {
    const buffer = new Uint32Array(1);
    const limit = Math.floor(2 ** 32 / max) * max;
    do crypto.getRandomValues(buffer); while (buffer[0] >= limit);
    return (buffer[0] % max) + 1;
  }

  /**
   * Rola os dados principais (somando ou pegando o maior) e soma os dados de
   * bônus (`spec.extra`) e o bônus fixo.
   */
  function rollDice(spec, random = randomInt) {
    const { count, sides, bonus, mode } = normalizeRollSpec(spec);
    const throwDice = (n, s) => Array.from({ length: n }, () => random(s));
    const dice = throwDice(count, sides);
    const extra = normalizeExtraDice(spec.extra).map(term => ({ ...term, dice: throwDice(term.count, term.sides) }));
    const base = mode === 'max' ? Math.max(...dice) : sum(dice);
    return {
      count, sides, bonus, mode, dice, extra,
      kept: mode === 'max' ? dice.indexOf(base) : -1,
      total: base + sum(extra.map(term => sum(term.dice))) + bonus,
    };
  }

  const formatBonus = n => (n > 0 ? ` + ${n}` : n < 0 ? ` − ${-n}` : '');
  const formatExtraDice = (extra = []) => extra.map(term => ` + ${term.count}d${term.sides}`).join('');

  const describeRoll = ({ count, sides, bonus, mode, extra }) =>
    `${count}d${sides}${mode === 'max' && count > 1 ? ' (maior)' : ''}${formatExtraDice(extra)}${formatBonus(bonus)}`;

  function recordRoll(state, result, label = '', detail = '') {
    const entry = { id: newId(), label, detail, time: Date.now(), ...result };
    state.history = [entry, ...state.history].slice(0, HISTORY_SIZE);
    return entry;
  }

  /* ---------- Macros ---------- */
  function describeMacro(state, macro) {
    const countField = findField(state, macro.countField);
    const bonusField = findField(state, macro.bonusField);
    return `${countField ? `[${countField.label}]` : macro.count}d${macro.sides}`
      + (macro.mode === 'max' ? ' (maior)' : '')
      + formatExtraDice(macro.extraDice)
      + (bonusField ? ` + [${bonusField.label}]` : '')
      + formatBonus(macro.bonus);
  }

  /** Transforma a macro numa rolagem concreta usando os valores atuais da ficha. */
  function resolveMacro(state, macro) {
    const countField = findField(state, macro.countField);
    const bonusField = findField(state, macro.bonusField);
    const spec = {
      ...normalizeRollSpec({
        ...macro,
        count: countField ? fieldNumber(countField) : macro.count,
        bonus: macro.bonus + fieldNumber(bonusField),
      }),
      extra: macro.extraDice,
    };
    const detail = [
      countField && `${countField.label}: ${spec.count} dado(s)`,
      bonusField && `${bonusField.label}${formatBonus(fieldNumber(bonusField)) || ' + 0'}`,
    ].filter(Boolean).join(' · ');
    return { spec, label: macro.name, detail };
  }

  function saveMacro(state, data) {
    const macro = normalizeMacro(data, new Set(allFields(state).map(field => field.id)));
    if (!macro.name) macro.name = describeMacro(state, macro);
    const index = state.macros.findIndex(m => m.id === macro.id);
    if (index >= 0) state.macros[index] = macro;
    else state.macros.push(macro);
    return macro;
  }

  /* ---------- Exportação ---------- */
  const toExport = state => ({ format: 'ficha-rpg', version: 1, sections: state.sections, macros: state.macros });

  function exportFileName(state) {
    const firstText = allFields(state).find(field => field.kind === 'text' && field.value.trim());
    const name = (firstText ? firstText.value : 'ficha').trim().replace(/[^\p{L}\p{N}_-]+/gu, '_');
    return `${name || 'ficha'}.json`;
  }

  Ficha.core = {
    DICE_SIDES, FIELD_KINDS, SECTION_STYLES, MAX_EXTRA_DICE,
    toNumber, isNumericField,
    createDefaultState, normalizeState, normalizeRollSpec, normalizeMacro,
    findField, findSection, resourcePercent,
    addSection, removeSection, addField, removeField, moveSection, moveField, applyOrder,
    rollDice, describeRoll, recordRoll,
    describeMacro, resolveMacro, saveMacro,
    toExport, exportFileName,
  };
})(window.Ficha = window.Ficha || {});
