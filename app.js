const CONFIG = {
  clientId: '',
  pickerKey: '',
  appId: '',
  scope: 'https://www.googleapis.com/auth/drive.file',
  ...(window.REQUIREMENTS_CONFIG || {}),
}

const COLUMNS = {
  '客戶': ['客戶ID', '客戶名稱', '聯絡人', '電子郵件', '電話', '備註'],
  '需求單': ['需求單ID', '客戶ID', '專案名稱', '專案類型', '目標', '目標使用者', '需求與功能', '驗收標準', '預算', '時程', '其他備註', '建立時間'],
  '自訂選項': ['分類', '選項'],
}

const state = {
  tokenClient: null,
  accessToken: '',
  pickerReady: false,
  identityReady: false,
  spreadsheetId: '',
  spreadsheetName: '',
  clients: [],
  requirements: [],
  options: [],
}

const byId = (id) => document.getElementById(id)

function setStatus(message, isError = false) {
  const status = byId('status')
  status.textContent = message
  status.classList.toggle('is-error', isError)
}

function setBusy(busy) {
  for (const button of document.querySelectorAll('[data-action]')) {
    button.disabled = busy
  }
}

function showConnected(connected) {
  byId('connect-panel').hidden = connected
  byId('workspace').hidden = !connected
  byId('sheet-name').textContent = connected ? state.spreadsheetName : ''
}

function clearPrivateView() {
  state.spreadsheetId = ''
  state.spreadsheetName = ''
  state.clients = []
  state.requirements = []
  state.options = []
  byId('client-select').replaceChildren()
  byId('project-type').replaceChildren()
  byId('requirement-list').replaceChildren()
  byId('requirement-form').reset()
  showConnected(false)
}

async function sheetsRequest(path, options = {}) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${state.spreadsheetId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  const data = await response.json()
  if (!response.ok) {
    const reason = data.error?.message || `Google 試算表回應 ${response.status}`
    throw new Error(reason)
  }
  return data
}

function escapeRange(name) {
  return encodeURIComponent(`'${name}'!A:Z`)
}

async function prepareSpreadsheet() {
  const metadata = await sheetsRequest('?fields=properties(title),sheets(properties(title))')
  const existing = new Set((metadata.sheets || []).map((sheet) => sheet.properties.title))
  const missing = Object.keys(COLUMNS).filter((name) => !existing.has(name))
  if (missing.length > 0) {
    const approval = window.confirm(`這份試算表尚缺少「${missing.join('、')}」工作表。要在你選取的試算表中建立這些空白工作表嗎？`)
    if (approval) {
      await sheetsRequest(':batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }),
      })
    } else {
      throw new Error('未建立必要工作表，沒有修改試算表。')
    }
  }

  const ranges = Object.keys(COLUMNS).map((name) => `ranges=${escapeRange(name)}`).join('&')
  const result = await sheetsRequest(`/values:batchGet?${ranges}`)
  const headersToWrite = []
  for (const [index, name] of Object.keys(COLUMNS).entries()) {
    const currentRows = result.valueRanges?.[index]?.values || []
    const firstRow = currentRows[0] || []
    if (firstRow.length === 0) {
      if (currentRows.some((row) => row.length > 0)) {
        throw new Error(`「${name}」工作表已有資料但沒有標題列。為保護原資料，已停止連接。`)
      } else {
        headersToWrite.push({ range: `'${name}'!A1`, values: [COLUMNS[name]] })
      }
    } else if (COLUMNS[name].some((header, column) => firstRow[column] !== header)) {
      throw new Error(`「${name}」工作表欄位與工具格式不同。為保護原資料，已停止連接，未覆寫任何儲存格。`)
    }
  }
  if (headersToWrite.length > 0) {
    await sheetsRequest('/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data: headersToWrite }),
    })
  }
  state.spreadsheetName = metadata.properties?.title || '已連接的試算表'
}

function rowObject(columns, row) {
  return Object.fromEntries(columns.map((column, index) => [column, row[index] || '']))
}

function appendOption(select, value, label) {
  const option = document.createElement('option')
  option.value = value
  option.textContent = label
  select.append(option)
}

function renderClients() {
  const select = byId('client-select')
  select.replaceChildren()
  appendOption(select, '', '選擇既有客戶，或在下方新增')
  for (const client of state.clients) {
    appendOption(select, client['客戶ID'], client['客戶名稱'])
  }
}

function renderProjectTypes() {
  const select = byId('project-type')
  select.replaceChildren()
  const types = ['網站', 'App', '內部系統', '自動化', '其他']
  for (const option of state.options) {
    if (option['分類'] === '專案類型' && option['選項']) {
      types.push(option['選項'])
    }
  }
  for (const type of new Set(types)) {
    appendOption(select, type, type)
  }
}

function renderFeatureOptions() {
  const container = byId('feature-options')
  container.replaceChildren()
  const textarea = byId('requirement-form').elements.namedItem('features')
  for (const option of state.options) {
    if (option['分類'] === '功能' && option['選項']) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = option['選項']
      button.addEventListener('click', () => {
        textarea.value = [textarea.value.trim(), option['選項']].filter(Boolean).join('\n')
        textarea.focus()
      })
      container.append(button)
    }
  }
}

function renderRequirements() {
  const list = byId('requirement-list')
  list.replaceChildren()
  if (state.requirements.length === 0) {
    const empty = document.createElement('p')
    empty.textContent = '這份試算表還沒有需求單。'
    list.append(empty)
  } else {
    for (const requirement of state.requirements.slice(-8).reverse()) {
      const item = document.createElement('li')
      const title = document.createElement('strong')
      const date = document.createElement('span')
      title.textContent = requirement['專案名稱'] || '未命名需求'
      date.textContent = requirement['建立時間'] || ''
      item.append(title, date)
      list.append(item)
    }
  }
}

async function refreshData() {
  const ranges = Object.keys(COLUMNS).map((name) => `ranges=${escapeRange(name)}`).join('&')
  const result = await sheetsRequest(`/values:batchGet?${ranges}`)
  const rows = result.valueRanges || []
  state.clients = (rows[0]?.values || []).slice(1).filter((row) => row[0] && row[1]).map((row) => rowObject(COLUMNS['客戶'], row))
  state.requirements = (rows[1]?.values || []).slice(1).filter((row) => row[0]).map((row) => rowObject(COLUMNS['需求單'], row))
  state.options = (rows[2]?.values || []).slice(1).filter((row) => row[0] && row[1]).map((row) => rowObject(COLUMNS['自訂選項'], row))
  renderClients()
  renderProjectTypes()
  renderFeatureOptions()
  renderRequirements()
}

async function selectSpreadsheet() {
  setBusy(true)
  try {
    if (!state.identityReady || !state.pickerReady) {
      throw new Error('Google 連接元件仍在載入，請稍後再試。')
    }
    state.tokenClient.callback = (response) => {
      if (response.error) {
        setStatus('Google 授權未完成，請重試。', true)
        setBusy(false)
      } else {
        state.accessToken = response.access_token
        const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        view.setMode(google.picker.DocsViewMode.LIST)
        const picker = new google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(state.accessToken)
          .setDeveloperKey(CONFIG.pickerKey)
          .setAppId(CONFIG.appId)
          .setCallback(onPicked)
          .build()
        picker.setVisible(true)
        setBusy(false)
      }
    }
    state.tokenClient.requestAccessToken({ prompt: state.accessToken ? '' : 'consent' })
  } catch (error) {
    setStatus(error.message, true)
    setBusy(false)
  }
}

async function onPicked(data) {
  if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
    const document = data[google.picker.Response.DOCUMENTS]?.[0]
    if (document) {
      state.spreadsheetId = document[google.picker.Document.ID]
      setBusy(true)
      setStatus('正在檢查試算表格式…')
      try {
        await prepareSpreadsheet()
        await refreshData()
        showConnected(true)
        setStatus('已連接你的 Google 試算表。資料只會在你的瀏覽器與 Google 之間傳送。')
      } catch (error) {
        clearPrivateView()
        setStatus(error.message, true)
      } finally {
        setBusy(false)
      }
    }
  }
}

async function appendRow(sheet, values) {
  await sheetsRequest(`/values/${escapeRange(sheet)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [values] }),
  })
}

async function saveClient(event) {
  event.preventDefault()
  const form = event.currentTarget
  const name = form.elements.namedItem('name').value.trim()
  if (name) {
    setBusy(true)
    try {
      const id = crypto.randomUUID()
      await appendRow('客戶', [id, name, form.elements.namedItem('contact').value.trim(), form.elements.namedItem('email').value.trim(), form.elements.namedItem('phone').value.trim(), ''])
      await refreshData()
      byId('client-select').value = id
      form.reset()
      setStatus('客戶已寫入你的 Google 試算表。')
    } catch (error) {
      setStatus(`儲存客戶失敗：${error.message}`, true)
    } finally {
      setBusy(false)
    }
  } else {
    setStatus('請先輸入客戶名稱。', true)
  }
}

async function saveRequirement(event) {
  event.preventDefault()
  const form = event.currentTarget
  const clientId = byId('client-select').value
  const title = form.elements.namedItem('title').value.trim()
  if (clientId && title) {
    setBusy(true)
    try {
      const value = (name) => form.elements.namedItem(name).value.trim()
      await appendRow('需求單', [
        crypto.randomUUID(), clientId, title, value('projectType'), value('goal'), value('audience'),
        value('features'), value('acceptance'), value('budget'), value('timeline'), value('notes'),
        new Date().toISOString(),
      ])
      await refreshData()
      form.reset()
      byId('client-select').value = clientId
      setStatus('需求單已寫入你的 Google 試算表。')
    } catch (error) {
      setStatus(`儲存需求單失敗：${error.message}`, true)
    } finally {
      setBusy(false)
    }
  } else {
    setStatus('請選擇客戶並填寫專案名稱。', true)
  }
}

function disconnect() {
  if (state.accessToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(state.accessToken, () => {})
  }
  state.accessToken = ''
  clearPrivateView()
  setStatus('已中斷連接。這個頁面不保留試算表內容或授權憑證。')
}

window.onGoogleApiLoad = () => {
  gapi.load('picker', { callback: () => { state.pickerReady = true } })
}

window.onGoogleIdentityLoad = () => {
  if (!CONFIG.clientId || !CONFIG.pickerKey || !CONFIG.appId || CONFIG.clientId.startsWith('__')) {
    setStatus('Google 授權設定尚未完成，工具暫時無法連接試算表。', true)
  } else {
    state.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.clientId,
      scope: CONFIG.scope,
      callback: () => {},
    })
    state.identityReady = true
    byId('connect').disabled = false
  }
}

byId('connect').addEventListener('click', selectSpreadsheet)
byId('disconnect').addEventListener('click', disconnect)
byId('refresh').addEventListener('click', async () => {
  setBusy(true)
  try {
    await refreshData()
    setStatus('已從你的 Google 試算表重新載入資料。')
  } catch (error) {
    setStatus(`重新載入失敗：${error.message}`, true)
  } finally {
    setBusy(false)
  }
})
byId('client-form').addEventListener('submit', saveClient)
byId('requirement-form').addEventListener('submit', saveRequirement)
