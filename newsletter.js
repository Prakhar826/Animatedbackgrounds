var telegram_bot_id = "1971157964:AAFeeavv4YDH3qyQ0y1AJUNKxi-x-tSrBhU";
//chat id
var chat_id = 1167770874;
var u_name, email, message;
var ready = function () {
    email = document.getElementById("email").value;
    message = "Email: " + email;
};
const s = document.querySelector('.Subscribe');

var sender = function () {
    event.preventDefault();
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
