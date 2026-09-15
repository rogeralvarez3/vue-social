// Cambiar entre pestañas de login / registro
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('form-login').classList.toggle('hidden', btn.dataset.tab !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', btn.dataset.tab !== 'register');
  });
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    const data = await Api.login({
      identifier: document.getElementById('login-identifier').value.trim(),
      password: document.getElementById('login-password').value
    });
    Auth.setAccessToken(data.accessToken);
    Auth.setUser(data.user);
    window.location.href = '/feed.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.textContent = '';
  try {
    const data = await Api.register({
      fullName: document.getElementById('reg-fullname').value.trim(),
      username: document.getElementById('reg-username').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value
    });
    Auth.setAccessToken(data.accessToken);
    Auth.setUser(data.user);
    window.location.href = '/feed.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// Si ya hay sesion activa, saltar directo al feed
(async () => {
  if (Auth.getAccessToken()) {
    window.location.href = '/feed.html';
  }
})();
