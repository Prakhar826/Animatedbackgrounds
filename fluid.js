//$(document).ready(function() {
//$('.search-box').focus();
//});

const wrapper = document.querySelector(".wrapper");
const header = document.querySelector(".header");

wrapper.addEventListener("scroll", (e) => {
  e.target.scrollTop > 25
    ? header.classList.add("header-shadow")
    : header.classList.remove("header-shadow");
});


/*=============== Animated Backgrounds list ===============*/


let Backgrounds1=["atzedent/pen/vYrbzXL", "chrisgannon/pen/oNdaobM", "learosema/pen/GRxbdzN", "jaredstanley/pen/RwywQzG", "ksenia-k/pen/jXbWaJ", "tmrDevelops/pen/JGvyra", "MillerTime/pen/NWPPyrX", "darrylhuffman/pen/JEdWzp", "shubniggurath/pen/ppOgPW", "shubniggurath/pen/MGdMbo", "teolitto/pen/KwOVvL", "shubniggurath/pen/gvvVvY", "al-ro/pen/ZeWeoB", "remid/pen/OgYjYV", "TomHinton/pen/zYRxYZK", "alexandrix/pen/zWjpqa", "wvnl/pen/GYgWwJ", "darrylhuffman/pen/OjjPBN", "TomHinton/pen/yLKwgyo", "trajektorijus/pen/VwvLxYW",         ]


function replaceTerm(Backgrounds1) { return Backgrounds1.map(function(element) { // Replace the term "/pen/" with "/full/" 
  return element.replace("/pen/", "/full/"); }); }

const Backgrounds2 = replaceTerm(Backgrounds1);

/*for (var i = 0; i < Backgrounds1.length; i++) {
  
var abcdef = Backgrounds1[i];
  
  let a = document.getElementById('main')

  a.innerHTML = a.innerHTML + '<figure id="open-modal' + i + '" class="modal__button"  style="background-image: url(https://shots.codepen.io/' + abcdef + '-800.jpg)"></figure><div class="modal__container modal-container close-modal" id="modal-container' + i + '"><div class="modal__content"><div class="modal__close close-modal" title="Close"><i class="bx bx-x"></i></div><div class="iframe-head"><h5>Animated backgrounds</h5></div><iframe src="https://codepen.io/' + abcdef + '" style="border:0px #ffffff none;" name="myiFrame" frameborder="1" height="400px" class="modal__img" ></iframe><h1 class="modal__title">Good Job!</h1><button class="modal__button modal__button-width">View status</button><button class="modal__button-link close-modal">Close</button></div></div></div>';
 
}*/

const itemsPerPage = 5; // Number of items to display per page
let currentPage = 0; // The current page being displayed

function displayPage(page) {
  // Clear the current page
  document.getElementById("wave").innerHTML = "";

  // Calculate the starting and ending indices for the current page
  const startIndex = page * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Loop through the array and display the elements for the current page
  for (let i = startIndex; i < endIndex; i++) {
    if (i >= Backgrounds1.length) {
      break;
    }

    // Append the element to the page
    let a = document.getElementById("wave")

    a.innerHTML = a.innerHTML + '<script async type="text/javascript" src="//cdn.carbonads.com/carbon.js?serve=CESI523J&placement=animatedbackgroundsme" id="_carbonads_js"> </script><button onclick="nextPage()" id="load-more" class="modal__button bg-button">Load More</button><figure id="open-modal' + i + '" class="modal__button"  style="background-image: url(https://shots.codepen.io/' + Backgrounds1[i] + '-800.jpg)"></figure><div class="modal__container modal-container close-modal" id="modal-container' + i + '"><div class="modal__content"><div class="modal__close close-modal" title="Close"><i class="bx bx-x"></i></div><div class="iframe-head"><h5>Animated backgrounds</h5></div><iframe src="https://codepen.io/' + Backgrounds2[i] + '" style="border:0px #ffffff none;" name="myiFrame" frameborder="1" height="400px" class="modal__img" ></iframe><a href="https://codepen.io/'+ Backgrounds1[i] +'" target= "_blank"><button class="modal__button modal__button-width">Get Code</button></a><button class="modal__button-link close-modal">Close</button></div></div></div>';

  }

  

  /*=============== SHOW MODAL ===============*/

  const showModal = (openButton, modalContent) => {
    const openBtn = document.getElementById(openButton),
      modalContainer = document.getElementById(modalContent)

    if (openBtn && modalContainer) {
      openBtn.addEventListener('click', () => {
        modalContainer.classList.add('show-modal')
      })
    }
  }

  for (var i = 0; i < Backgrounds1.length; i++) {


    showModal('open-modal' + i, 'modal-container' + i)
  }

  /*=============== CLOSE MODAL ===============*/

  const buttons = document.querySelectorAll('.close-modal');  // Get all buttons with the class 'my-button'
  const elements = document.querySelectorAll('.modal-container');  // Get all elements with the class 'my-element'

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      elements.forEach((element) => {
        element.classList.remove('show-modal');  // Remove the 'my-class' class from each element
      });
    });
  });




  //Scroll to the top

if (page === 0) {
  return; 
}
  
const arrayContainer = document.getElementById("wave"); // Scroll the array container into view 
  
arrayContainer.scrollIntoView();
  

}



// Display the first page when the page loads
displayPage(0);




/*=============== SHOW MODAL ===============*/




/*=============== test ===============
function nextPage() {
  currentPage++;
  displayPage(currentPage);
}
*/
function nextPage() {
  // Return early if the current page is the last page

  

  

if (currentPage >= Math.ceil(Backgrounds1.length / itemsPerPage) - 1) {
       return;
  } else {
    currentPage++;
    displayPage(currentPage);
  }
  
  
  
}



  
  
  




