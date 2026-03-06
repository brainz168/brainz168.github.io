const { signals } = datastar;

// Signal transforms for formatting
signals.currency = (value) => {
  if (typeof value !== "number") return value || '—';
  value = Math.round(value * 100) / 100;
  value = (value === -0 ? 0 : value);
  const result = value.toLocaleString('en', { style: 'currency', currency: 'USD' });
  return result.includes('NaN') ? value : result;
};

signals.asDate = (value) => {
  if (!value) return value;
  if (typeof value === 'number') value = new Date(value * 1000);
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: '2-digit',
    timeZone: 'UTC'
  });
};

function tweakUrl(url) {
  if (!url) return url;
  if (url.toLowerCase().startsWith('http')) return url;
  return 'https://' + url;
}

function addDemo(row) {
  if (!row) row = {};
  if (!('Issued' in row) && !('Due' in row)) {
    for (const key of ['Number', 'Issued', 'Due']) {
      if (!(key in row)) row[key] = key;
    }
    for (const key of ['Subtotal', 'Deduction', 'Taxes', 'Total']) {
      if (!(key in row)) row[key] = key;
    }
    if (!('Note' in row)) row.Note = '(Anything in a Note column goes here)';
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
    };
  }
  if (!row.Client) {
    row.Client = {
      Name: 'Client.Name',
      Street1: 'Client.Street1',
      Street2: 'Client.Street2',
      City: 'Client.City',
      State: '.State',
      Zip: '.Zip'
    };
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

function prepareList(lst, order) {
  if (!lst) return [];
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
  try {
    signals.status.value = '';
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

    const want = new Set(Object.keys(addDemo({})));
    const accepted = new Set(['References']);
    const importance = ['Number', 'Client', 'Items', 'Total', 'Invoicer', 'Due',
      'Issued', 'Subtotal', 'Deduction', 'Taxes', 'Note', 'Paid'];
    
    let help = null;
    
    if (!('Due' in row || 'Issued' in row)) {
      const seen = new Set(Object.keys(row).filter(k => k !== 'id' && k !== '_error_'));
      help = {};
      help.seen = prepareList([...seen]);
      const missing = [...want].filter(k => !seen.has(k));
      const ignoring = [...seen].filter(k => !want.has(k) && !accepted.has(k));
      const recognized = [...seen].filter(k => want.has(k) || accepted.has(k));
      
      if (missing.length > 0) help.expected = prepareList(missing, importance);
      if (ignoring.length > 0) help.ignored = prepareList(ignoring);
      if (recognized.length > 0) help.recognized = prepareList(recognized);
      if (!seen.has('References') && !(row.Issued || row.Due)) {
        help.SuggestReferencesColumn = true;
      }
    }
    
    signals.help.value = help;
    row = addDemo(row);
    
    if (!row.Subtotal && !row.Total && row.Items && Array.isArray(row.Items)) {
      try {
        row.Subtotal = row.Items.reduce((a, b) => a + (b.Price || 0) * (b.Quantity || 0), 0);
        row.Total = row.Subtotal + (row.Taxes || 0) - (row.Deduction || 0);
      } catch (e) {
        console.error(e);
      }
    }
    
    if (row.Invoicer && row.Invoicer.Website && !row.Invoicer.Url) {
      row.Invoicer.Url = tweakUrl(row.Invoicer.Website);
    }

    signals.invoice.value = row;
    window.invoice = row;
    
  } catch (err) {
    console.error(err);
    signals.invoice.value = {};
    signals.status.value = String(err).replace(/^Error: /, '');
  }
}

// Initialize Grist
if (typeof grist !== 'undefined') {
  grist.ready();
  grist.onRecord(updateInvoice);

  grist.on('message', msg => {
    if (msg.tableId && !signals.rowConnected.value) {
      grist.docApi.fetchSelectedTable().then(table => {
        if (table.id && table.id.length >= 1) {
          signals.haveRows.value = true;
        }
      }).catch(e => console.log(e));
    }
    if (msg.tableId) signals.tableConnected.value = true;
    if (msg.tableId && !msg.dataChange) signals.rowConnected.value = true;
  });
}

// Demo mode
if (document.location.search.includes('demo')) {
  const exampleData = {
    Number: 'INV-001',
    Issued: new Date().getTime() / 1000,
    Due: new Date(Date.now() + 30*24*60*60*1000).getTime() / 1000,
    Invoicer: {
      Name: 'Acme Corp',
      Street1: '123 Business St',
      City: 'New York',
      State: 'NY',
      Zip: '10001',
      Email: 'billing@acme.com',
      Phone: '(555) 123-4567',
      Website: 'acme.com'
    },
    Client: {
      Name: 'Client Inc',
      Street1: '456 Client Ave',
      City: 'Los Angeles',
      State: 'CA',
      Zip: '90001'
    },
    Items: [
      { Description: 'Consulting', Price: 150, Quantity: 10, Total: 1500 },
      { Description: 'Development', Price: 200, Quantity: 5, Total: 1000 }
    ],
    Subtotal: 2500,
    Taxes: 200,
    Total: 2700,
    Note: 'Thank you for your business!'
  };
  updateInvoice(exampleData);
}

if (document.location.search.includes('labels')) {
  updateInvoice({});
}