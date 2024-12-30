// Telegram Bot Configuration
var telegram_bot_id = "1971157964:AAFeeavv4YDH3qyQ0y1AJUNKxi-x-tSrBhU";
var chat_id = 1167770874;

// Function to send a message to Telegram
var sender = function () {
  var emailInput = document.getElementById("email");
  var emailValue = emailInput.value.trim();
  var errorMessage = document.querySelector('.error-message');

  if (emailValue === "") {
    // Show error message if email is empty
    errorMessage.textContent = 'Please enter a valid email address.';
    errorMessage.style.display = 'block';
    return false;
  }

  // Hide error message
  errorMessage.style.display = 'none';

  // Prepare message
  var message = "Email: " + emailValue;

  // AJAX settings to send the message to Telegram
  var settings = {
    "async": true,
    "crossDomain": true,
    "url": "https://api.telegram.org/bot" + telegram_bot_id + "/sendMessage",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "cache-control": "no-cache"
    },
    "data": JSON.stringify({
      "chat_id": chat_id,
      "text": message
    })
  };

  // Send the request
  $.ajax(settings).done(function (response) {
    console.log(response);

    // Show success animation
    const form = document.querySelector('.Subscribe');
    form.classList.toggle('Subscribe--loading');
    setTimeout(() => {
      form.classList.remove('Subscribe--loading');
      form.classList.toggle('Subscribe--complete');
    }, 2000);

    // Remove complete state and clear the input field
    setTimeout(() => {
      form.classList.remove('Subscribe--complete');
      emailInput.value = '';
    }, 5000);
  });

  return false; // Prevent form submission
};

// Animation (Optional)
const b = document.querySelector('button');
b.addEventListener('click', (e) => {
  e.preventDefault(); // Prevent default button behavior
  sender(); // Call the sender function
});
