/*
 * PONTO DE ENTRADA — monta as peças e liga a barra do topo, as abas e o menu.
 */
(function (Ficha) {
  'use strict';

  const { core, storage } = Ficha;
  const { $, $$ } = Ficha.dom;

  const store = Ficha.createStore();
  const sheetView = Ficha.createSheetView($('#sheet'), store);
  const macroDialog = Ficha.createMacroDialog(store);
  const diceView = Ficha.createDiceView(store, macroDialog.open);

  /* ---------- Salvamento ---------- */
  store.onSaveError(() => { $('#save-error').hidden = false; });
  addEventListener('pagehide', store.flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });

  /* ---------- Modo de edição do layout ---------- */
  const layoutToggle = $('#layout-toggle');
  layoutToggle.addEventListener('click', () => {
    const editing = !sheetView.isEditing();
    sheetView.setEditing(editing);
    layoutToggle.setAttribute('aria-pressed', String(editing));
    layoutToggle.textContent = editing ? 'Concluir' : 'Editar layout';
  });

  /* ---------- Abas (celular) ---------- */
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    document.body.dataset.tab = tab.dataset.tab;
    $$('.tab').forEach(other => other.setAttribute('aria-selected', String(other === tab)));
    scrollTo({ top: 0 });
  }));

  /* ---------- Menu: exportar, importar, restaurar ---------- */
  const menu = $('#menu');
  document.addEventListener('click', e => { if (menu.open && !menu.contains(e.target)) menu.open = false; });

  const onMenu = (selector, action) => $(selector).addEventListener('click', () => {
    menu.open = false;
    action();
  });

  onMenu('#export-btn', () => storage.downloadJson(core.exportFileName(store.state), core.toExport(store.state)));
  onMenu('#import-btn', () => $('#import-file').click());
  onMenu('#reset-btn', () => {
    if (confirm('Restaurar a ficha padrão? Todos os dados, macros e histórico atuais serão apagados.')) store.actions.reset();
  });

  $('#import-file').addEventListener('change', async e => {
    const [file] = e.target.files;
    e.target.value = '';
    if (!file) return;
    const data = await storage.readJsonFile(file).catch(() => null);
    if (!core.normalizeState(data)) {
      alert('Não foi possível importar: o arquivo não é uma ficha válida.');
      return;
    }
    if (confirm('Substituir a ficha atual pela importada?')) store.actions.importState(data);
  });

  /* ---------- Início ---------- */
  sheetView.render();
  diceView.render();

  // Instalação como app e uso offline (exige http/https; não funciona em file://)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})(window.Ficha = window.Ficha || {});
