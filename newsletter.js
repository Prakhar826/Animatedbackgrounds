// Telegram bot settings
var telegram_bot_id = "1971157964:AAFeeavv4YDH3qyQ0y1AJUNKxi-x-tSrBhU";
var chat_id = 1167770874;

// Function to handle button state updates
const updateButtonMsg = function () {
  const button = document.getElementById("button");
  const span = button.querySelector("span"); // Access the span inside the button
  span.textContent = "Sending..."; // Update text to "Sending..."
  button.classList.add("animated"); // Add animation class
  setTimeout(finalButtonMsg, 2000); // Transition to the next state after 2 seconds
};

// Function to display "Done!" message
const finalButtonMsg = function () {
  const button = document.getElementById("button");
  const span = button.querySelector("span"); // Access the span inside the button
  span.textContent = "Done!"; // Update text to "Done!"
  setTimeout(setInitialButtonState, 2000); // Reset button state after 2 seconds
};

// Function to reset button state back to "Send"
const setInitialButtonState = function () {
  const button = document.getElementById("button");
  const span = button.querySelector("span"); // Access the span inside the button
  span.textContent = "Send"; // Reset text to "Send"
  button.classList.remove("animated"); // Remove animation class
};

// Function to handle form submission
const sender = function () {
  // Get the email address from the input field
  const email = document.getElementById("email").value;
  const message = "Email: " + email; // Create the message to send

  // AJAX request settings
  const settings = {
    async: true,
    crossDomain: true,
    url: "https://api.telegram.org/bot" + telegram_bot_id + "/sendMessage",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cache-control": "no-cache",
    },
    data: JSON.stringify({
      chat_id: chat_id, // Specify the chat ID
      text: message, // Message content
    }),
  };

  // Send AJAX request using jQuery
  $.ajax(settings).done(function (response) {
    console.log(response); // Log the response from Telegram API
    updateButtonMsg(); // Trigger button animation and state changes
    document.getElementById("email").value = ""; // Clear the email input field
  });

  return false; // Prevent default form submission behavior
};
