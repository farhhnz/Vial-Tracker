const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

let accessToken = null;
let spreadsheetId = null;
let folderId = null;

// ==============================
// 1. AUTHENTICATION & INIT
// ==============================
export const loginToGoogle = (onSuccess, onError) => {
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (response) => {
      if (response.error) {
        onError(response.error);
        return;
      }
      accessToken = response.access_token;
      try {
        await initWorkspace();
        onSuccess(accessToken);
      } catch (err) {
        onError(err.message);
      }
    },
  });
  client.requestAccessToken();
};

const initWorkspace = async () => {
  // 1. Setup Drive Folder
  folderId = await findOrCreateFolder('Event Coordinator - PO');
  
  // 2. Setup Spreadsheet
  spreadsheetId = await findOrCreateSpreadsheet('Event_Coordinator_Database');
};

// ==============================
// 2. GOOGLE DRIVE API (PDFs)
// ==============================
const findOrCreateFolder = async (folderName) => {
  const q = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  
  if (data.files && data.files.length > 0) return data.files[0].id;

  // Create folder if not exists
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' })
  });
  const createData = await createRes.json();
  return createData.id;
};

export const uploadPOFile = async (file, poNumber) => {
  const metadata = {
    name: `PO_${poNumber}_${file.name}`,
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });
  const data = await res.json();
  return data.id; // Simpan ID ini ke Google Sheets PurchaseOrders
};

// ==============================
// 3. GOOGLE SHEETS API (DATABASE)
// ==============================
const findOrCreateSpreadsheet = async (fileName) => {
  // Cari di Drive
  const q = `name='${fileName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  
  if (data.files && data.files.length > 0) return data.files[0].id;

  // Create Spreadsheet dengan tab yang dibutuhkan
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: fileName },
      sheets: [
        { properties: { title: 'Events' } },
        { properties: { title: 'Checklist' } },
        { properties: { title: 'Requirements' } },
        { properties: { title: 'PurchaseOrders' } },
        { properties: { title: 'Vials' } }
      ]
    })
  });
  const createData = await createRes.json();
  
  // Set headers untuk setiap sheet (Format Header JSON sederhana)
  await setHeaders(createData.spreadsheetId);
  return createData.spreadsheetId;
};

const setHeaders = async (id) => {
  const headers = {
    'Events': [['id', 'name', 'client', 'location', 'dateStart', 'dateEnd', 'type', 'status', 'notes', 'manpower']],
    'PurchaseOrders': [['id', 'poNumber', 'supplier', 'purchaseDate', 'vaccineType', 'quantity', 'pricePerVial', 'totalPrice', 'fileId', 'lotNumber', 'expiredDate', 'notes']],
    'Vials': [['id', 'poId', 'vaccineType', 'lotNumber', 'expiredDate', 'dosesTotal', 'dosesRemaining', 'status', 'usageHistory']]
  };

  const dataToUpdate = Object.keys(headers).map(sheet => ({
    range: `${sheet}!A1`,
    values: headers[sheet]
  }));

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'RAW', data: dataToUpdate })
  });
};

// --- CRUD OPERATIONS ---
export const getSheetData = async (sheetName) => {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}?valueRenderOption=UNFORMATTED_VALUE`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  if (!data.values || data.values.length === 0) return [];
  
  // Convert Array 2D ke Array of Objects berdasarkan Row 1 (Header)
  const headers = data.values[0];
  return data.values.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      // Parse JSON string kembali ke object jika itu array/object tersarang
      try {
        obj[header] = row[index] && row[index].startsWith('[') || row[index].startsWith('{') 
          ? JSON.parse(row[index]) 
          : row[index];
      } catch(e) {
        obj[header] = row[index];
      }
    });
    return obj;
  });
};

export const appendRow = async (sheetName, dataObject) => {
  // Ambil header dulu untuk mapping object ke array
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:Z1`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const headerData = await res.json();
  const headers = headerData.values[0];

  const rowData = headers.map(header => {
    const val = dataObject[header];
    return typeof val === 'object' ? JSON.stringify(val) : (val || '');
  });

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [rowData] })
  });
};
