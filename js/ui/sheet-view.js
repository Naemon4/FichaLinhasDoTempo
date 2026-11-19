/*
 * INTERFACE — a ficha: seções, campos e o modo "Editar layout".
 */
(function (Ficha) {
  'use strict';

  const { core } = Ficha;
  const { $, $$, h, optionList, iconButton, trackDrag } = Ficha.dom;
  const KEY_DELTA = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };

  Ficha.createSheetView = function createSheetView(root, store) {
    const { actions } = store;
    let editing = false;

    function render() {
      const { sections } = store.state;
      document.body.classList.toggle('layout-mode', editing);
      root.replaceChildren(...sections.map(renderSection));
      if (editing) {
        root.append(h('button', { class: 'btn add-section', type: 'button', onclick: addSection }, '+ Nova seção'));
      } else if (!sections.length) {
        root.append(h('p', { class: 'card empty' }, 'Ficha vazia. Use “Editar layout” para criar seções.'));
      }
    }

    function setEditing(value) {
      editing = value;
      render();
    }

    /* ---------- Seções ---------- */
    function renderSection(section) {
      return h('section', { class: `card section style-${section.style}`, dataset: { id: section.id } },
        editing ? sectionEditor(section) : h('div', { class: 'section-head' }, h('h2', {}, section.title || 'Sem título')),
        h('div', { class: 'fields' }, section.fields.map(renderField)),
        editing && addFieldForm(section),
      );
    }

    function sectionEditor(section) {
      return h('div', { class: 'section-head' },
        dragHandle('Mover seção', 'section', section.id, delta => actions.moveSection(section.id, delta)),
        h('input', {
          class: 'input title-input', type: 'text', value: section.title, 'aria-label': 'Nome da seção',
          oninput: e => actions.renameSection(section.id, e.target.value),
        }),
        h('select', {
          class: 'input style-select', 'aria-label': 'Estilo da seção', value: section.style,
          onchange: e => actions.setSectionStyle(section.id, e.target.value),
        }, optionList(core.SECTION_STYLES)),
        iconButton('✕', 'Excluir seção', () => confirmRemoveSection(section), 'danger'),
      );
    }

    function addFieldForm(section) {
      const kind = h('select', {
        class: 'input', 'aria-label': 'Tipo do novo campo', value: section.style === 'cards' ? 'text' : 'number',
      }, optionList(core.FIELD_KINDS));
      const add = () => {
        const field = actions.addField(section.id, kind.value);
        if (field) focusLater(`[data-id="${field.id}"] .label-input`);
      };
      return h('div', { class: 'add-field' }, kind, h('button', { class: 'btn', type: 'button', onclick: add }, '+ Campo'));
    }

    function addSection() {
      const section = actions.addSection();
      focusLater(`[data-id="${section.id}"] .title-input`);
    }

    function confirmRemoveSection(section) {
      const count = section.fields.length;
      const extra = count ? ` e seus ${count} campo(s)` : '';
      if (confirm(`Excluir a seção “${section.title || 'Sem título'}”${extra}?`)) actions.removeSection(section.id);
    }

    /* ---------- Campos ---------- */
    function renderField(field) {
      const inputId = `f-${field.id}`;
      return h('div', { class: `field kind-${field.kind}`, dataset: { id: field.id } },
        h('div', { class: 'field-top' }, editing
          ? fieldEditor(field)
          : h('label', { class: 'field-label', for: inputId }, field.label || 'Sem nome')),
        CONTROLS[field.kind](field, inputId),
      );
    }

    function fieldEditor(field) {
      return [
        dragHandle('Mover campo', 'field', field.id, delta => actions.moveField(field.id, delta)),
        h('input', {
          class: 'input label-input', type: 'text', value: field.label, 'aria-label': 'Nome do campo',
          oninput: e => actions.renameField(field.id, e.target.value),
        }),
        iconButton('✕', `Excluir campo ${field.label}`, () => {
          if (confirm(`Excluir o campo “${field.label || 'Sem nome'}”?`)) actions.removeField(field.id);
        }, 'danger'),
      ];
    }

    const setValue = (field, key = 'value') => value => actions.setFieldValue(field.id, key, value);

    const numberInput = ({ id, value, label, onInput }) => h('input', {
      id, class: 'input', type: 'number', step: 'any', value, 'aria-label': label,
      oninput: e => onInput(core.toNumber(e.target.value)),
    });

    const CONTROLS = {
      text: (field, id) => h('input', {
        id, class: 'input', type: 'text', autocomplete: 'off', value: field.value,
        oninput: e => setValue(field)(e.target.value),
      }),

      textarea(field, id) {
        const textarea = h('textarea', {
          id, class: 'input', rows: 5, value: field.value,
          oninput: e => { autoGrow(e.target); setValue(field)(e.target.value); },
        });
        requestAnimationFrame(() => autoGrow(textarea));
        return textarea;
      },

      number: (field, id) => numberInput({ id, value: field.value, onInput: setValue(field) }),

      resource(field, id) {
        const fill = h('div', { class: 'bar-fill' });
        const bar = h('div', { class: 'bar', 'aria-hidden': 'true' }, fill);
        const refresh = () => {
          const percent = core.resourcePercent(field);
          fill.style.width = `${percent}%`;
          bar.classList.toggle('low', field.max > 0 && percent <= 25);
        };
        const update = key => value => { setValue(field, key)(value); refresh(); };

        const current = numberInput({ id, value: field.value, onInput: update('value') });
        const max = numberInput({ value: field.max, label: `${field.label} máximo`, onInput: update('max') });
        const step = delta => () => {
          const value = core.toNumber(field.value) + delta;
          current.value = value;
          update('value')(value);
        };

        refresh();
        return h('div', { class: 'resource' },
          h('div', { class: 'resource-row' },
            h('button', { class: 'step', type: 'button', 'aria-label': `Diminuir ${field.label}`, onclick: step(-1) }, '−'),
            current, h('span', { class: 'sep' }, '/'), max,
            h('button', { class: 'step', type: 'button', 'aria-label': `Aumentar ${field.label}`, onclick: step(1) }, '+'),
          ),
          bar,
        );
      },
    };

    /* ---------- Mover (arrastar ou teclado) ---------- */
    function dragHandle(label, kind, id, moveBy) {
      return h('button', {
        class: 'icon-btn handle', type: 'button', title: 'Arraste para mover',
        'aria-label': `${label} (as setas do teclado também movem)`,
        onpointerdown: e => {
          if (e.pointerType !== 'mouse' || e.button === 0) startDrag(e, e.currentTarget, kind);
        },
        onkeydown: e => {
          const delta = KEY_DELTA[e.key];
          if (!delta) return;
          e.preventDefault();
          if (moveBy(delta)) $(`[data-id="${id}"] .handle`, root)?.focus();
        },
      }, '⠿');
    }

    function startDrag(event, handle, kind) {
      const element = handle.closest(kind === 'section' ? '.section' : '.field');
      element.classList.add('dragging');
      if (kind === 'section') {
        document.body.classList.add('dragging-sections'); // recolhe as seções para facilitar
        element.scrollIntoView({ block: 'nearest' });
      }

      trackDrag(event, handle, {
        onMove: (x, y, hit) => (kind === 'section' ? placeSection(element, y, hit) : placeField(element, x, y, hit)),
        onEnd: moved => {
          document.body.classList.remove('dragging-sections');
          element.classList.remove('dragging');
          if (moved && !actions.applyOrder(readOrderFromDom())) render();
        },
      });
    }

    function placeSection(element, y, hit) {
      const target = hit.closest('.section');
      if (!target || target === element || target.parentElement !== root) return false;
      const { top, height } = target.getBoundingClientRect();
      root.insertBefore(element, y > top + height / 2 ? target.nextSibling : target);
      return true;
    }

    function placeField(element, x, y, hit) {
      const target = hit.closest('.field');
      if (target === element) return false;

      if (target) {
        const zone = target.parentElement;
        const rect = target.getBoundingClientRect();
        const singleColumn = rect.width > zone.clientWidth * 0.6;
        const after = singleColumn ? y > rect.top + rect.height / 2 : x > rect.left + rect.width / 2;
        zone.insertBefore(element, after ? target.nextSibling : target);
        return true;
      }

      // Sobre outra seção (inclusive vazia): vai para o fim dela
      const section = hit.closest('.section');
      if (!section || section.contains(element)) return false;
      $('.fields', section).append(element);
      return true;
    }

    function readOrderFromDom() {
      return $$(':scope > .section', root).map(section => ({
        id: section.dataset.id,
        fieldIds: $$(':scope > .fields > .field', section).map(field => field.dataset.id),
      }));
    }

    /* ---------- Auxiliares ---------- */
    function autoGrow(textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(120, textarea.scrollHeight + 2)}px`;
    }

    function focusLater(selector) {
      requestAnimationFrame(() => {
        const input = $(selector, root);
        if (!input) return;
        input.focus();
        input.select();
        input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }

    store.on('sheet', render);
    return { render, setEditing, isEditing: () => editing };
  };
})(window.Ficha = window.Ficha || {});
