const $ = id => document.getElementById(id);
const api = window.zeraManagement;
async function action(run) {
  document.querySelectorAll('button').forEach(button => {button.disabled=true;});
  try { const response = await run(); if (response?.error) throw new Error(response.error); $('result').textContent = response?.message || 'Saved.'; }
  catch(error) { $('result').textContent = error.message; }
  finally { document.querySelectorAll('button').forEach(button => {button.disabled=false;}); await refresh(false); }
}
async function refresh(initial) {
  const state = await api.status();
  $('status').textContent = state.reporting?.message || 'Complete workspace setup first.';
  $('update').textContent = state.reporting?.update ? `Version ${state.reporting.update.version} available. Signing verification pending; installation is manual.` : 'No update available. Local work is available without an internet connection.';
  $('download').disabled = !state.reporting?.update;
  if (initial) { $('enabled').checked=state.shared.enabled; $('server-address').value=state.shared.address || ''; $('autostart').checked=state.shared.autoStart; }
}
$('connect').onsubmit = event => {event.preventDefault(); void action(async () => { const result = await api.connect({address:$('address').value.trim(),name:$('name').value.trim(),code:$('code').value.trim()}); if (!result.error) $('code').value=''; return result; });};
$('check').onclick = () => action(() => api.check());
$('download').onclick = () => action(() => api.download());
for (const [id,kind] of [['certificate','cert'],['key','key']]) $(id).onclick = () => action(() => api.choose(kind));
$('services').onsubmit = event => {event.preventDefault(); void action(() => api.services({enabled:$('enabled').checked,address:$('server-address').value.trim(),autoStart:$('autostart').checked}));};
void refresh(true);
