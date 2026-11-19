/*
 * INFRAESTRUTURA — onde os dados moram: localStorage e arquivos .json.
 */
(function (Ficha) {
  'use strict';

  const STORAGE_KEY = 'ficha-rpg-v1';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null; // storage bloqueado ou conteúdo corrompido
    }
  }

  /** @returns {boolean} se conseguiu salvar */
  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false; // sem espaço ou storage bloqueado
    }
  }

  function downloadJson(fileName, data) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const readJsonFile = async file => JSON.parse(await file.text());

  Ficha.storage = { load, save, downloadJson, readJsonFile };
})(window.Ficha = window.Ficha || {});
