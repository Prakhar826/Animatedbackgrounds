const s = document.querySelector('.Subscribe');
const b = document.querySelector('button');
const emailInput = document.querySelector('input[type="text"]');
const errorMessage = document.querySelector('.error-message');

b.addEventListener('click', (e) => {
  e.preventDefault();
  const emailValue = emailInput.value.trim();

  if (emailValue !== '') {
    // Hide the error message
    errorMessage.style.display = 'none';

    // Show loading state
    s.classList.toggle('Subscribe--loading');
    setTimeout(() => {
      s.classList.remove('Subscribe--loading');
      s.classList.toggle('Subscribe--complete');
    }, 2000);

    // Remove complete state
    setTimeout(() => {
      s.classList.remove('Subscribe--complete');
      // Clear the input field
      emailInput.value = '';
    }, 5000);
  } else {
    // Show the error message
    errorMessage.textContent = 'Please enter a valid email address.';
    errorMessage.style.display = 'block';
  }
});
