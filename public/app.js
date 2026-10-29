const form = document.querySelector('#quote-form');
const message = document.querySelector('#form-message');
const destinationSelect = document.querySelector('#destino');
const submitButton = form.querySelector('button[type="submit"]');

document.querySelectorAll('[data-destination]').forEach((button) => {
  button.addEventListener('click', () => {
    destinationSelect.value = button.dataset.destination;

    document.querySelector('#orcamento').scrollIntoView({
      behavior: 'smooth'
    });

    destinationSelect.focus({ preventScroll: true });
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  message.textContent = '';
  message.className = 'form-message';

  const data = Object.fromEntries(
    new FormData(form).entries()
  );

  if (data.ida && data.volta && data.volta < data.ida) {
    showMessage(
      'A data de volta deve ser igual ou posterior à data de ida.',
      'error'
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Enviando...';

  try {
    const response = await fetch('/api/orcamentos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.erro || 'Não foi possível registrar a solicitação.'
      );
    }

    showMessage(
      `${result.mensagem || 'Solicitação registrada com sucesso.'} Número: ${result.id}.`,
      'success'
    );

    form.reset();
  } catch (error) {
    showMessage(
      `${error.message} Verifique se o servidor está funcionando e tente novamente.`,
      'error'
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar solicitação';
  }
});

function showMessage(text, type) {
  message.textContent = text;
  message.className = `form-message ${type}`;
}