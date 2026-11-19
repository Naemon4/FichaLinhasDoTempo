/*
 * INTERFACE — janela de criar/editar macro.
 */
(function (Ficha) {
  'use strict';

  const { core } = Ficha;
  const { $, $$, h, iconButton } = Ficha.dom;

  Ficha.createMacroDialog = function createMacroDialog(store) {
    const dialog = $('#macro-dialog');
    const form = $('#macro-form');
    const inputs = {
      title: $('#macro-title'),
      name: $('#m-name'),
      countField: $('#m-count-field'),
      count: $('#m-count'),
      sidesPreset: $('#m-sides-preset'),
      sides: $('#m-sides'),
      bonus: $('#m-bonus'),
      bonusField: $('#m-bonus-field'),
      extraList: $('#m-extra'),
      addExtra: $('#m-add-extra'),
      preview: $('#macro-preview'),
    };
    let editingId = null;

    inputs.sidesPreset.replaceChildren(
      ...core.DICE_SIDES.map(sides => h('option', { value: sides }, `d${sides}`)),
      h('option', { value: 'custom' }, 'Personalizado'),
    );

    /** Preenche um <select> com os campos numéricos da ficha, agrupados por seção. */
    function fillFieldSelect(select, emptyLabel, selectedId) {
      const groups = store.state.sections
        .map(section => ({ section, fields: section.fields.filter(core.isNumericField) }))
        .filter(group => group.fields.length)
        .map(({ section, fields }) => h('optgroup', { label: section.title || 'Sem título' },
          fields.map(field => h('option', { value: field.id }, field.label || 'Sem nome'))));
      select.replaceChildren(h('option', { value: '' }, emptyLabel), ...groups);
      select.value = selectedId || '';
    }

    /** Uma linha "[qtd] d[lados] ✕" da lista de dados de bônus. */
    function extraDiceRow(term = { count: 1, sides: 6 }) {
      const sidesOptions = core.DICE_SIDES.includes(term.sides)
        ? core.DICE_SIDES
        : [...core.DICE_SIDES, term.sides].sort((a, b) => a - b);
      const row = h('div', { class: 'extra-row' },
        h('input', {
          class: 'input extra-count', type: 'number', min: 1, max: 100, value: term.count,
          'aria-label': 'Quantidade de dados de bônus',
        }),
        h('select', { class: 'input extra-sides', 'aria-label': 'Tipo do dado de bônus', value: String(term.sides) },
          sidesOptions.map(sides => h('option', { value: sides }, `d${sides}`))),
        iconButton('✕', 'Remover dado de bônus', () => { row.remove(); refresh(); }, 'danger'),
      );
      return row;
    }

    const readExtraDice = () => $$('.extra-row', inputs.extraList).map(row => ({
      count: $('.extra-count', row).value,
      sides: $('.extra-sides', row).value,
    }));

    function readForm() {
      return {
        id: editingId,
        name: inputs.name.value,
        countField: inputs.countField.value || null,
        count: inputs.count.value,
        sides: inputs.sidesPreset.value === 'custom' ? inputs.sides.value : inputs.sidesPreset.value,
        bonus: inputs.bonus.value,
        bonusField: inputs.bonusField.value || null,
        extraDice: readExtraDice(),
        mode: form.elements['m-mode'].value,
      };
    }

    function refresh() {
      inputs.count.hidden = Boolean(inputs.countField.value);
      inputs.sides.hidden = inputs.sidesPreset.value !== 'custom';
      inputs.addExtra.disabled = inputs.extraList.children.length >= core.MAX_EXTRA_DICE;
      inputs.preview.textContent = core.describeMacro(store.state, core.normalizeMacro(readForm()));
    }

    function open(macro) {
      const data = macro || core.normalizeMacro({ sides: store.state.roller.sides });
      editingId = macro ? macro.id : null;
      inputs.title.textContent = macro ? 'Editar macro' : 'Nova macro';
      inputs.name.value = data.name;
      fillFieldSelect(inputs.countField, 'Número fixo', data.countField);
      inputs.count.value = data.count;
      inputs.sidesPreset.value = core.DICE_SIDES.includes(data.sides) ? String(data.sides) : 'custom';
      inputs.sides.value = data.sides;
      inputs.bonus.value = data.bonus;
      fillFieldSelect(inputs.bonusField, '+ Nenhum campo', data.bonusField);
      inputs.extraList.replaceChildren(...data.extraDice.map(extraDiceRow));
      form.elements['m-mode'].value = data.mode;
      refresh();
      dialog.showModal();
    }

    inputs.addExtra.addEventListener('click', () => {
      const row = extraDiceRow();
      inputs.extraList.append(row);
      $('.extra-count', row).focus();
      refresh();
    });
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);
    form.addEventListener('submit', e => {
      if (e.submitter && e.submitter.value === 'save') store.actions.saveMacro(readForm());
    });

    // Fecha ao clicar fora — só se o clique também começou fora
    // (evita fechar ao selecionar texto e soltar o mouse fora da janela).
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', e => { pressedOutside = e.target === dialog; });
    dialog.addEventListener('click', e => { if (pressedOutside && e.target === dialog) dialog.close(); });

    return { open };
  };
})(window.Ficha = window.Ficha || {});
