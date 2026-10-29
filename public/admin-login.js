const loginForm = document.querySelector('#admin-login-form');
const loginMessage = document.querySelector('#login-message');
const loginButton = document.querySelector('#login-button');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';
  loginMessage.className = 'form-message';
  loginButton.disabled = true;
  loginButton.textContent = 'Verificando...';

  const dados = Object.fromEntries(new FormData(loginForm).entries());

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    const resultado = await response.json();

    if (!response.ok) {
      throw new Error(resultado.erro || 'Não foi possível entrar.');
    }

    window.location.assign(resultado.redirect || '/admin');
  } catch (error) {
    loginMessage.textContent = error.message;
    loginMessage.className = 'form-message error';
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Entrar';
  }
});
