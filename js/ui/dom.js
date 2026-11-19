/*
 * INTERFACE — utilitários de DOM compartilhados pelas telas.
 */
(function (Ficha) {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /**
   * Cria um elemento. Textos viram nós de texto (nunca HTML), então é seguro
   * para conteúdo digitado pelo usuário.
   * props: class, dataset, value, on<evento>, e qualquer atributo.
   */
  function h(tag, props = {}, ...children) {
    const element = document.createElement(tag);
    let value;
    for (const [key, prop] of Object.entries(props)) {
      if (prop == null || prop === false) continue;
      if (key === 'class') element.className = prop;
      else if (key === 'dataset') Object.assign(element.dataset, prop);
      else if (key === 'value') value = prop;
      else if (key.startsWith('on') && typeof prop === 'function') element.addEventListener(key.slice(2), prop);
      else element.setAttribute(key, prop === true ? '' : String(prop));
    }
    for (const child of children.flat(Infinity)) {
      if (child == null || child === false || child === '') continue;
      element.append(child instanceof Node ? child : String(child));
    }
    if (value !== undefined) element.value = value; // depois dos <option> de um <select>
    return element;
  }

  const optionList = labels => Object.entries(labels).map(([value, text]) => h('option', { value }, text));

  const iconButton = (symbol, label, onclick, variant = '') =>
    h('button', { class: `icon-btn ${variant}`, type: 'button', title: label, 'aria-label': label, onclick }, symbol);

  function isOnScreen(element) {
    const rect = element.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > 70 && rect.top < innerHeight - 80;
  }

  let toastTimer;
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  /**
   * Acompanha um arrasto (mouse ou toque) iniciado em `handle`, com rolagem
   * automática perto das bordas da tela.
   * onMove(x, y, elementoSobODedo) → true se mudou algo; onEnd(houveMudança).
   */
  function trackDrag(event, handle, { onMove, onEnd }) {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('is-dragging');

    let moved = false;
    let scrollSpeed = 0;
    let frame = requestAnimationFrame(function autoScroll() {
      if (scrollSpeed) scrollBy(0, scrollSpeed);
      frame = requestAnimationFrame(autoScroll);
    });

    const move = e => {
      scrollSpeed = e.clientY < 90 ? -12 : e.clientY > innerHeight - 90 ? 12 : 0;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      if (hit && onMove(e.clientX, e.clientY, hit)) moved = true;
    };
    const end = () => {
      cancelAnimationFrame(frame);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      document.body.classList.remove('is-dragging');
      onEnd(moved);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  Ficha.dom = { $, $$, h, optionList, iconButton, isOnScreen, showToast, trackDrag };
})(window.Ficha = window.Ficha || {});
