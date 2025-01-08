// Telegram bot settings
var telegram_bot_id = "1971157964:AAFeeavv4YDH3qyQ0y1AJUNKxi-x-tSrBhU";
var chat_id = 1167770874;

const updateButtonMsg = function () {
  const button = document.getElementById("button");
  button.classList.add("animated");
  button.innerHTML = '<span>Sending...</span>';
  setTimeout(finalButtonMsg, 2000);
};

const finalButtonMsg = function () {
  const button = document.getElementById("button");
  button.innerHTML = '<span>Done!</span>';
  setTimeout(setInitialButtonState, 2000);
};

const setInitialButtonState = function () {
  const button = document.getElementById("button");
  button.classList.remove("animated");
  button.innerHTML = '<span>Send</span>';
};

const sender = function () {
  const email = document.getElementById("email").value;
  const message = "Email: " + email;

  const settings = {
    async: true,
    crossDomain: true,
    url: "https://api.telegram.org/bot" + telegram_bot_id + "/sendMessage",
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

  // AJAX request using jQuery
  $.ajax(settings).done(function (response) {
    console.log(response);
    updateButtonMsg();
    document.getElementById("email").value = "";
  });

  return false; // Prevent default form submission
};
