// Telegram Bot Configuration
const telegram_bot_id = "1971157964:AAFeeavv4YDHUxxxNKxi-x-tSrBhU"; // Replace with your bot token
const chat_id = 1167728xxx74; // Replace with your chat ID

// Function to handle the form submission
function sender() {
  const emailInput = document.getElementById("email");
  const emailValue = emailInput.value.trim();
  const errorMessage = document.querySelector('.error-message');

  // Validate email input
  if (emailValue === "") {
    errorMessage.textContent = 'Please enter a valid email address.';
    errorMessage.style.display = 'block';
    return false; // Prevent submission
  }

  // Hide error message if input is valid
  errorMessage.style.display = 'none';

  // Prepare the Telegram message
  const message = `Email: ${emailValue}`;

  // Send data to Telegram using AJAX
  const settings = {
    async: true,
    crossDomain: true,
    url: `https://api.telegram.org/bot${telegram_bot_id}/sendMessage`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cache-control": "no-cache"
    },
    data: JSON.stringify({
      chat_id: chat_id,
      text: message
    })
  };

  // AJAX call to send the message
  $.ajax(settings).done(function (response) {
    console.log("Message sent:", response);

    // Display success animation
    const form = document.querySelector('.Subscribe');
    form.classList.add('Subscribe--loading');
    setTimeout(() => {
      form.classList.remove('Subscribe--loading');
      form.classList.add('Subscribe--complete');
    }, 2000);

    // Clear input and reset form
    setTimeout(() => {
      form.classList.remove('Subscribe--complete');
      emailInput.value = '';
    }, 5000);
  });

  return false; // Prevent form submission and page refresh
}

// Optional: Add event listener for the button (in case of additional behavior)
const subscribeButton = document.getElementById("btn");
subscribeButton.addEventListener("click", (e) => {
  e.preventDefault(); // Prevent default button behavior
  sender(); // Call the sender function
});
