const form = document.getElementById('setup');
const database = document.getElementById('database');
const save = document.getElementById('save');
const result = document.getElementById('result');
const installButton = document.getElementById('install-button');
document.getElementById('install').addEventListener('submit', async event => {
  event.preventDefault();
  const password = document.getElementById('password').value;
  if (password !== document.getElementById('confirm').value) { result.textContent = 'Passwords do not match.'; return; }
  installButton.disabled = true; save.disabled = true;
  result.textContent = 'Preparing your workspace. Keep Zera open…';
  try {
    const response = await window.zeraSetup.install({businessName:document.getElementById('shop').value, name:document.getElementById('owner').value, email:document.getElementById('email').value, password});
    result.textContent = response.ok ? `Installation successful. Database, backend and frontend checks passed. Access: ${response.accessUrl}. Keep Zera running to use this address.` : response.error;
    if (response.ok) {
      document.getElementById('password').value = ''; document.getElementById('confirm').value = '';
      document.getElementById('install').hidden = true;
      document.querySelector('details').hidden = true;
      const open = document.createElement('button');
      open.type = 'button'; open.textContent = 'Open Zera';
      open.addEventListener('click', () => window.zeraSetup.open());
      result.after(open);
    }
  } catch { result.textContent = 'Setup failed. Try again or contact support.'; }
  finally { installButton.disabled = false; save.disabled = false; }
});
document.getElementById('show').addEventListener('change', event => { database.type = event.target.checked ? 'text' : 'password'; });
form.addEventListener('submit', async event => {
  event.preventDefault(); save.disabled = true; installButton.disabled = true; result.textContent = 'Checking database…';
  try {
    const response = await window.zeraSetup.save(database.value.trim());
    result.textContent = response.ok ? 'Saved. Restarting Zera…' : response.error;
    if (response.ok) database.value = '';
  } catch { result.textContent = 'Settings could not be saved. Please try again.'; }
  finally { save.disabled = false; installButton.disabled = false; }
});
