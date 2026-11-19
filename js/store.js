/*
 * APLICAÇÃO — único lugar que altera o estado.
 * Cada ação: aplica uma regra do domínio → agenda o salvamento → avisa as telas
 * interessadas pelos "tópicos" (sheet, macros, roller, history).
 */
(function (Ficha) {
  'use strict';

  const { core, storage } = Ficha;
  const SAVE_DELAY_MS = 300;
  const ALL_TOPICS = ['sheet', 'macros', 'roller', 'history'];

  Ficha.createStore = function createStore() {
    let state = core.normalizeState(storage.load()) || core.createDefaultState();
    const listeners = new Map();
    let saveTimer = null;
    let handleSaveError = () => {};

    function emit(topics) {
      for (const topic of topics) (listeners.get(topic) || []).forEach(listener => listener());
    }

    function saveNow() {
      clearTimeout(saveTimer);
      saveTimer = null;
      if (!storage.save(state)) handleSaveError();
    }

    /** Salva já, se houver alteração pendente (ex.: ao fechar o app). */
    function flush() {
      if (saveTimer !== null) saveNow();
    }

    function commit(mutate, ...topics) {
      const result = mutate(state);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, SAVE_DELAY_MS);
      emit(topics);
      return result;
    }

    function replace(next) {
      state = next;
      saveNow();
      emit(ALL_TOPICS);
    }

    const editField = (id, change) => s => {
      const field = core.findField(s, id);
      if (field) change(field);
    };
    const editSection = (id, change) => s => {
      const section = core.findSection(s, id);
      if (section) change(section);
    };

    const actions = {
      // Ficha — digitar valores não redesenha nada (mantém o foco no campo)
      setFieldValue: (id, key, value) => commit(editField(id, field => { field[key] = value; })),
      renameField: (id, label) => commit(editField(id, field => { field.label = label; }), 'macros'),
      addField: (sectionId, kind) => commit(s => core.addField(s, sectionId, kind), 'sheet'),
      removeField: id => commit(s => core.removeField(s, id), 'sheet', 'macros'),
      moveField: (id, delta) => commit(s => core.moveField(s, id, delta), 'sheet'),

      addSection: () => commit(core.addSection, 'sheet'),
      renameSection: (id, title) => commit(editSection(id, section => { section.title = title; })),
      setSectionStyle: (id, style) => commit(editSection(id, section => { section.style = style; }), 'sheet'),
      removeSection: id => commit(s => core.removeSection(s, id), 'sheet', 'macros'),
      moveSection: (id, delta) => commit(s => core.moveSection(s, id, delta), 'sheet'),
      applyOrder: order => commit(s => core.applyOrder(s, order), 'sheet'),

      // Dados
      setRoller: patch => commit(s => { s.roller = core.normalizeRollSpec({ ...s.roller, ...patch }); }, 'roller'),
      roll: (spec, label, detail) => commit(s => core.recordRoll(s, core.rollDice(spec), label, detail), 'history'),
      rollMacro(id) {
        const macro = state.macros.find(m => m.id === id);
        if (!macro) return null;
        const { spec, label, detail } = core.resolveMacro(state, macro);
        return actions.roll(spec, label, detail);
      },
      clearHistory: () => commit(s => { s.history = []; }, 'history'),

      // Macros
      saveMacro: data => commit(s => core.saveMacro(s, data), 'macros'),
      removeMacro: id => commit(s => { s.macros = s.macros.filter(m => m.id !== id); }, 'macros'),

      // Ficha inteira
      importState(raw) {
        const next = core.normalizeState(raw);
        if (next) replace(next);
        return Boolean(next);
      },
      reset: () => replace(core.createDefaultState()),
    };

    return {
      get state() { return state; },
      actions,
      flush,
      on(topic, listener) {
        listeners.set(topic, [...(listeners.get(topic) || []), listener]);
      },
      onSaveError(listener) {
        handleSaveError = listener;
      },
    };
  };
})(window.Ficha = window.Ficha || {});
