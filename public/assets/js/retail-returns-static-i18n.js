import { getLocale } from './i18n.js?v=20260812-099';

if (getLocale() === 'en') {
  const messages = globalThis.APP_I18N?.messages || {};
  const details = messages.pos_returns_details || {};
  const form = messages.pos_returns_form || {};
  const history = messages.pos_returns_history || {};

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && value) element.textContent = value;
  };
  const setFirstText = (selector, value) => {
    const element = document.querySelector(selector);
    const node = element ? [...element.childNodes].find(item => item.nodeType === Node.TEXT_NODE) : null;
    if (node && value) node.nodeValue = value;
  };

  setText('.return-search-panel .section-heading p', details.search?.description);
  const search = document.querySelector('#returnSaleSearch');
  if (search && details.search?.placeholder) search.placeholder = details.search.placeholder;
  setText('#clearSelectedSale', details.editor?.new_bill);
  document.querySelectorAll('.return-table th').forEach((cell, index) => {
    const keys = ['product', 'sold', 'returned', 'return_now', 'unit_price', 'refund'];
    if (details.table?.[keys[index]]) cell.textContent = details.table[keys[index]];
  });

  const labels = document.querySelectorAll('.return-form-grid label');
  const labelKeys = ['date', 'refund_method', 'reason', 'note'];
  labels.forEach((label, index) => setFirstText(`.return-form-grid label:nth-child(${index + 1})`, form.form?.[labelKeys[index]]));
  document.querySelectorAll('#refundMethod option').forEach(option => {
    if (form.form?.[option.value]) option.textContent = form.form[option.value];
  });
  const reason = document.querySelector('#returnReason');
  if (reason && form.form?.reason_placeholder) reason.placeholder = form.form.reason_placeholder;
  setText('.return-summary span', form.summary?.total);

  setText('.return-history-panel h2', history.history?.title);
  setText('.return-history-panel .section-heading p', history.history?.description);
  setFirstText('.return-history-search', history.history?.search_label);
  const historySearch = document.querySelector('#returnHistorySearch');
  if (historySearch && history.history?.search_placeholder) historySearch.placeholder = history.history.search_placeholder;
  setText('#returnHistoryEmpty', history.history?.empty);
}
