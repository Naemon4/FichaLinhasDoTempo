/*
 * INTERFACE — painel de dados: rolador, resultado, macros e histórico.
 * O "resultado" é sempre a primeira entrada do histórico.
 */
(function (Ficha) {
  'use strict';

  const { core } = Ficha;
  const { $, $$, h, iconButton, isOnScreen, showToast } = Ficha.dom;

  Ficha.createDiceView = function createDiceView(store, openMacroDialog) {
    const { actions } = store;
    const els = {
      picker: $('#dice-picker'),
      count: $('#r-count'),
      bonus: $('#r-bonus'),
      expression: $('#r-expr'),
      result: $('#result-card'),
      macros: $('#macro-list'),
      history: $('#history'),
    };
    const customSides = h('input', {
      class: 'input die-custom', type: 'number', min: 2, max: 1000, placeholder: 'd?',
      'aria-label': 'Dado personalizado (número de lados)',
    });

    /* ---------- Rolador ---------- */
    function bindRoller() {
      els.picker.replaceChildren(
        ...core.DICE_SIDES.map(sides => h('button', {
          class: 'btn die-btn', type: 'button', dataset: { sides },
          onclick: () => actions.setRoller({ sides }),
        }, `d${sides}`)),
        customSides,
      );

      // Só grava valores completos; ao sair do campo, mostra o valor válido de novo.
      const bindNumber = (input, key, isComplete) => {
        input.addEventListener('input', () => { if (isComplete(input.value)) actions.setRoller({ [key]: input.value }); });
        input.addEventListener('change', renderRoller);
      };
      bindNumber(customSides, 'sides', v => Number(v) >= 2);
      bindNumber(els.count, 'count', v => v !== '');
      bindNumber(els.bonus, 'bonus', v => v !== '');

      $$('[data-step]').forEach(button => button.addEventListener('click', () => {
        const [key, delta] = button.dataset.step.split(':');
        actions.setRoller({ [key]: store.state.roller[key] + Number(delta) });
      }));
      $$('#r-mode [data-mode]').forEach(button => button.addEventListener('click', () => {
        actions.setRoller({ mode: button.dataset.mode });
      }));
      $('#r-roll').addEventListener('click', () => announce(actions.roll(store.state.roller)));
    }

    function renderRoller() {
      const { roller } = store.state;
      const isCustom = !core.DICE_SIDES.includes(roller.sides);
      $$('[data-sides]', els.picker).forEach(button =>
        button.setAttribute('aria-pressed', String(Number(button.dataset.sides) === roller.sides)));
      $$('#r-mode [data-mode]').forEach(button =>
        button.setAttribute('aria-checked', String(button.dataset.mode === roller.mode)));
      customSides.classList.toggle('active', isCustom);
      syncInput(customSides, isCustom ? roller.sides : '');
      syncInput(els.count, roller.count);
      syncInput(els.bonus, roller.bonus);
      els.expression.textContent = core.describeRoll(roller);
    }

    function syncInput(input, value) {
      if (input.value !== String(value)) input.value = value;
    }

    /** Se o card de resultado não estiver à vista, mostra um aviso flutuante. */
    function announce(entry) {
      if (entry && !isOnScreen(els.result)) showToast(`${entry.label || core.describeRoll(entry)}: ${entry.total}`);
    }

    /* ---------- Resultado ---------- */
    function renderResult(animate = false) {
      const entry = store.state.history[0];
      if (!entry) {
        els.result.replaceChildren(h('p', { class: 'empty' }, 'Escolha um dado e role.'));
        return;
      }
      els.result.replaceChildren(
        entry.label && h('div', { class: 'result-label' }, entry.label),
        h('div', { class: animate ? 'result-total pop' : 'result-total' }, entry.total),
        h('div', { class: 'result-expr' }, core.describeRoll(entry)),
        entry.detail && h('div', { class: 'result-detail' }, entry.detail),
        h('div', { class: 'chips' },
          entry.dice.map((value, index) => h('span', { class: chipClass(entry, value, index) }, value)),
          extraDiceOf(entry).map(term => [
            h('span', { class: 'chip-sep', 'aria-hidden': 'true' }, '+'),
            term.dice.map(value => h('span', { class: 'chip extra', title: `d${term.sides}` }, value)),
          ]),
        ),
      );
    }

    const extraDiceOf = entry => entry.extra || []; // entradas antigas não têm dados de bônus

    function chipClass(entry, value, index) {
      const classes = ['chip'];
      if (entry.mode === 'max' && entry.count > 1) classes.push(index === entry.kept ? 'kept' : 'dim');
      if (value === entry.sides) classes.push('crit');
      else if (value === 1) classes.push('fail');
      return classes.join(' ');
    }

    /* ---------- Macros ---------- */
    function renderMacros() {
      const { macros } = store.state;
      if (!macros.length) {
        els.macros.replaceChildren(h('p', { class: 'empty' }, 'Nenhuma macro ainda. Crie atalhos para as rolagens que você mais usa.'));
        return;
      }
      els.macros.replaceChildren(...macros.map(macro => h('div', { class: 'macro' },
        h('button', { class: 'btn macro-roll', type: 'button', onclick: () => announce(actions.rollMacro(macro.id)) },
          h('span', {}, macro.name),
          h('span', { class: 'macro-expr' }, core.describeMacro(store.state, macro)),
        ),
        iconButton('✎', `Editar macro ${macro.name}`, () => openMacroDialog(macro)),
        iconButton('✕', `Excluir macro ${macro.name}`, () => {
          if (confirm(`Excluir a macro “${macro.name}”?`)) actions.removeMacro(macro.id);
        }, 'danger'),
      )));
    }

    /* ---------- Histórico ---------- */
    function renderHistory() {
      const { history } = store.state;
      if (!history.length) {
        els.history.replaceChildren(h('p', { class: 'empty' }, 'Suas rolagens aparecem aqui.'));
        return;
      }
      const time = entry => new Date(entry.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const allDiceText = entry => [entry.dice, ...extraDiceOf(entry).map(term => term.dice)]
        .map(dice => `[${dice.join(', ')}]`).join(' + ');
      els.history.replaceChildren(...history.map(entry => h('div', { class: 'hist' },
        h('div', { class: 'hist-main' },
          h('div', { class: 'hist-title' }, entry.label || core.describeRoll(entry)),
          h('div', { class: 'hist-sub' },
            `${entry.label ? `${core.describeRoll(entry)} · ` : ''}${allDiceText(entry)} · ${time(entry)}`),
        ),
        h('div', { class: 'hist-total' }, entry.total),
      )));
    }

    /* ---------- Ligações ---------- */
    bindRoller();
    $('#new-macro').addEventListener('click', () => openMacroDialog(null));
    $('#clear-history').addEventListener('click', () => {
      if (store.state.history.length && confirm('Limpar todo o histórico de rolagens?')) actions.clearHistory();
    });

    store.on('roller', renderRoller);
    store.on('macros', renderMacros);
    store.on('history', () => { renderResult(true); renderHistory(); });

    return {
      render() {
        renderRoller();
        renderMacros();
        renderHistory();
        renderResult();
      },
    };
  };
})(window.Ficha = window.Ficha || {});
