








//bot token
var telegram_bot_id = "1971157964:AAFeeavv4YDH3qyQ0y1AJUNKxi-x-tSrBhU";
//chat id
var chat_id = 1167770874;
var u_name, email, message;
var ready = function () {
    u_name = document.getElementById("name").value;
    email = document.getElementById("email").value;
    message = document.getElementById("message").value;
    message = "Name: " + u_name + "\nEmail: " + email + "\nMessage: " + message;
};
var sender = function () {
    ready();
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
    $.ajax(settings).done(function (response) {
        console.log(response);
    });
    document.getElementById("name").value = "";
    document.getElementById("email").value = "";
    document.getElementById("message").value = "";
    return false;
};












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


