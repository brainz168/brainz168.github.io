// invoice.js

function ready(fn) {
  if (document.readyState !== 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

/**
 * Demo is only shown when the row has no Issued or Due date.
 */
function addDemo(row) {
  if (!('Issued' in row) && !('Due' in row)) {
    for (const key of ['Number', 'Issued', 'Due']) {
      if (!(key in row)) { row[key] = key; }
    }
    for (const key of ['Subtotal', 'Deduction', 'Taxes', 'Total']) {
      if (!(key in row)) { row[key] = key; }
    }
    if (!('Note' in row)) { row.Note = '(Anything in a Note column goes here)'; }
  }
  if (!row.Invoicer) {
    row.Invoicer = {
      Name: 'Invoicer.Name',
      Street1: 'Invoicer.Street1',
      Street2: 'Invoicer.Street2',
      City: 'Invoicer.City',
      State: '.State',
      Zip: '.Zip',
      Email: 'Invoicer.Email',
      Phone: 'Invoicer.Phone',
      Website: 'Invoicer.Website'
    }
  }
  if (!row.Client) {
    row.Client = {
      Name: 'Client.Name',
      Street1: 'Client.Street1',
      Street2: 'Client.Street2',
      City: 'Client.City',
      State: '.State',
      Zip: '.Zip'
    }
  }
  if (!row.Items) {
    row.Items = [
      {
        Description: 'Items[0].Description',
        Quantity: '.Quantity',
        Total: '.Total',
        Price: '.Price',
      },
      {
        Description: 'Items[1].Description',
        Quantity: '.Quantity',
        Total: '.Total',
        Price: '.Price',
      },
    ];
  }
  return row;
}

function currency(value) {
  if (typeof value !== "number") {
    return value || '—';      // falsy value would be shown as a dash.
  }
  value = Math.round(value * 100) / 100;    // Round to nearest cent.
  value = (value === -0 ? 0 : value);       // Avoid negative zero.

  const result = value.toLocaleString('en', {
    style: 'currency', currency: 'USD'
  })
  if (result.includes('NaN')) {
    return value;
  }
  return result;
}

function asDate(value) {
  if (typeof(value) === 'number') {
    value = new Date(value * 1000);
  }
  const date = moment.utc(value)
  return date.isValid() ? date.format('MMMM DD, YYYY') : value;
};

function tweakUrl(url) {
  if (!url) { return url; }
  if (url.toLowerCase().startsWith('http')) {
    return url;
  }
  return 'https://' + url;
};

function prepareList(lst, order) {
  if (order) {
    let orderedLst = [];
    const remaining = new Set(lst);
    for (const key of order) {
      if (remaining.has(key)) {
        remaining.delete(key);
        orderedLst.push(key);
      }
    }
    lst = [...orderedLst].concat([...remaining].sort());
  } else {
    lst = [...lst].sort();
  }
  return lst;
}

function updateInvoice(row) {
  if (row === null) {
    throw new Error("(No data - not on row - please add or select a row)");
  }
  console.log("GOT...", JSON.stringify(row));
  if (row.References) {
    try {
      Object.assign(row, row.References);
    } catch (err) {
      throw new Error('Could not understand References column. ' + err);
    }
  }

  // Add some guidance about columns.
  const want = new Set(Object.keys(addDemo({})));
  const accepted = new Set(['References']);
  const importance = ['Number', 'Client', 'Items', 'Total', 'Invoicer', 'Due', 
                      'Issued', 'Subtotal', 'Deduction', 'Taxes', 'Note', 'Paid'];
  if (!('Due' in row || 'Issued' in row)) {
    const seen = new Set(Object.keys(row).filter(k => k !== 'id' && k !== '_error_'));
    const help = row.Help = {};
    help.seen = prepareList(seen);
    const missing = [...want].filter(k => !seen.has(k));
    const ignoring = [...seen].filter(k => !want.has(k) && !accepted.has(k));
    const recognized = [...seen].filter(k => want.has(k) || accepted.has(k));
    if (missing.length > 0) {
      help.expected = prepareList(missing, importance);
    }
    if (ignoring.length > 0) {
      help.ignored = prepareList(ignoring);
    }
    if (recognized.length > 0) {
      help.recognized = prepareList(recognized);
    }
    if (!seen.has('References') && !(row.Issued || row.Due)) {
      row.SuggestReferencesColumn = true;
    }
  }
  addDemo(row);
  if (!row.Subtotal && !row.Total && row.Items && Array.isArray(row.Items)) {
    try {
      row.Subtotal = row.Items.reduce((a, b) => a + b.Price * b.Quantity, 0);
      row.Total = row.Subtotal + (row.Taxes || 0) - (row.Deduction || 0);
    } catch (e) {
      console.error(e);
    }
  }
  if (row.Invoicer && row.Invoicer.Website && !row.Invoicer.Url) {
    row.Invoicer.Url = tweakUrl(row.Invoicer.Website);
  }

  // Make invoice information available for debugging.
  window.invoice = row;
  return row;
}

function renderInvoicer(arr) {
  return arr.map(business => {
    if (typeof business === 'string') {
      return `<div class="address newlined">${business}</div>`;
    } else {
      let html = `<div class="address"><span class="name">${business.Name || ''}</span><br />${business.Street1 || ''}<br />`;
      if (business.Street2) html += `${business.Street2}<br />`;
      html += `${business.City || ''} ${business.State || ''} ${business.Zip || ''}<br />`;
      if (business.Country) html += `${business.Country}<br />`;
      html += `</div>`;
      if (business.Email) html += `<div class="email">${business.Email}</div>`;
      if (business.Phone) html += `<div class="phone">${business.Phone}</div>`;
      if (business.Website) html += `<div class="website"><a href="${business.Url || ''}">${business.Website}</a></div>`;
      return html;
    }
  }).join('');
}

function renderClient(arr) {
  return arr.map(business => {
    let details = '';
    if (typeof business === 'string') {
      details = `<div class="newlined">${business}</div>`;
    } else {
      details = `<div>${business.Name || ''}</div>`;
      if (business.Street1) details += `${business.Street1}, `;
      if (business.Street2) details += `${business.Street2}, `;
      details += `${business.City || ''} ${business.State || ''} ${business.Zip || ''}`;
      if (business.Country) details += `<br />${business.Country}`;
    }
    return `<div class="client"><div class="title">Client</div><div class="details">${details}</div></div>`;
  }).join('');
}

function renderItems(items, total) {
  let html = '';
  if (!Array.isArray(items)) {
    html += `<tr><th>Description</th><th class="money">Total</th></tr>`;
    html += `<tr><td>${items || ''}</td><td class="money">${currency(total)}</td></tr>`;
  } else {
    html += `<tr><th>Description</th><th class="money">Unit Price</th><th class="number">Quantity</th><th class="money">Total</th></tr>`;
    items.forEach(item => {
      html += `<tr><td>${item.Description || ''}</td><td class="money">${currency(item.Price)}</td><td class="number">${item.Quantity || ''}</td><td class="money">${currency(item.Total)}</td></tr>`;
    });
  }
  return html;
}

function renderHelp(helps, suggest) {
  return helps.map(help => {
    let tableHtml = '';
    ['recognized', 'expected', 'ignored'].forEach(group => {
      let content = help[group] ? help[group].map(col => `<div class="column-name column-${group}">${col}</div>`).join('') : '&mdash;';
      tableHtml += `<tr><td class="key">${group}</td><td>${content}</td></tr>`;
    });
    let suggestHtml = suggest ? `<div>For structured address and item information, add a <span class="column-name">References</span> column with this formula:</div><div><pre>RECORD(rec, expand_refs=1)</pre></div>` : '';
    return `<div class="help"><div class="help-close">Add <span class="column-name">Due</span> or <span class="column-name">Issued</span> date to hide this help.</div><div class="title">Column information</div><div class="details"><table>${tableHtml}</table>${suggestHtml}</div></div>`;
  }).join('');
}
window.dispatchDemoIfNeeded = function() {
  const search = document.location.search;
  if (search.includes('demo')) {
    console.log('Dispatching demo event with data:', window.exampleData);  // Debug log
    if (!window.exampleData) {
      console.error('exampleData is undefined! Check exampleData.js.');
      return;
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('update-invoice', { detail: window.exampleData }));
    }, 500);  // 0.5s delay to ensure Datastar is fully initialized
  }else if(search.includes('labels')) {
    console.log('Dispatching demo event with labels');  // Debug log
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('update-invoice', { detail: {} }));
    }, 500);  // 0.5s delay to ensure Datastar is fully initialized
  }
};
ready(function() {
  const search = document.location.search;

  // Wrap Grist API calls in try-catch to handle standalone mode where Grist parent may not exist
  try {
    grist.ready();
    grist.onRecord(row => {
      window.dispatchEvent(new CustomEvent('update-invoice', {detail: row}));
    });

    // Monitor status so we can give user advice.
    let tableConnected = false;
    let rowConnected = false;
    let haveRows = false;
    grist.on('message', msg => {
      if (msg.tableId && !rowConnected) {
        grist.docApi.fetchSelectedTable().then(table => {
          haveRows = table.id && table.id.length >= 1;
          window.dispatchEvent(new CustomEvent('set-have-rows', {detail: haveRows}));
        }).catch(e => console.log(e));
      }
      if (msg.tableId) {
        tableConnected = true;
        window.dispatchEvent(new CustomEvent('set-table-connected', {detail: tableConnected}));
      }
      if (msg.tableId && !msg.dataChange) {
        rowConnected = true;
        window.dispatchEvent(new CustomEvent('set-row-connected', {detail: rowConnected}));
      }
    });
  } catch (e) {
    console.error('Grist API error (likely standalone mode):', e);
  }
});