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


let Backgrounds1 =["pleasedonotdisturb/pen/wvadazR", "MarkBoots/pen/LYjvEJj", "atzedent/pen/vYrbzXL", "TomHinton/pen/VwxOZBJ", "atzedent/pen/WNJqxYz", "prisoner849/pen/JjvQOXx",  "nicofonseca/pen/MWoeERO", "elwinvdhazel/pen/yOmezz", "carmenansio/pen/MWExRMQ", "shalanah/pen/ymRpPd",   "abhisack/pen/LNeXZP",             "Alca/pen/mdLaKyr", "rgbjoy/pen/KGjKMr", "kinglisky/pen/pejopv", "nitishkmrk/pen/dvBwVw", "svang/pen/EymwRL", "Squiggz12/pen/bVmVrG", "andytran/pen/MaRqwd", "calderonsteven/pen/YPyoVX", "grantcairnes/pen/MWbXgpp", "noahblon/pen/nQRxBV", "chrisblakley/pen/RRLWod", "luisjoserivera/pen/oePeNy", "zFunx/pen/oBJWqZ", "stolinski/pen/DjoXVM", "mukie/pen/abZmoeL", "roborich/pen/AmqdWE", "nss5161/pen/XZNROr", "vcomics/pen/JjpgBwY", "lovefield/pen/vEvqZV", "realjameal/pen/NxoZBq", "atzedent/pen/WNJOOJX", "tuckermassad/pen/rPYNLq", "ZachSaucier/pen/abGGKOY", "chrisgannon/pen/oNdaobM", "t_afif/pen/rNvLjmy", "winkerVSbecks/pen/gMOPqY", "thebabydino/pen/xqzxRL", "Alca/pen/OjwBEQ", "chrisgannon/pen/GywGLW", "sandrina-p/pen/mdbRKgg", "toshiya-marukubo/pen/powzLKr", "saconway/pen/MWgxYYL", "atzedent/pen/bGMdMEj", "YusukeNakaya/pen/XyOaBj", "Web_yuki1027/pen/yLgYpWM", "natewiley/pen/PwWxRd", "ksenia-k/pen/jXbWaJ", "YusukeNakaya/pen/xNdvKW", "robdimarzo/pen/VqjvqR", "mladen___/pen/gbvqBo", "vaibhavarora/pen/xmpxjp", "at80/pen/kyOdeK", "tmrDevelops/pen/JGvyra", "alphardex/pen/bGWYMwg", "alphardex/pen/RwKXJaO", "MillerTime/pen/NWPPyrX", "MillerTime/pen/ypWNOB", "MillerTime/pen/KeJegx", "natewiley/pen/yaZLgb", "raurir/pen/xxYgRK", "pouretrebelle/pen/jVrwzo", "raurir/pen/ygapbp", "raurir/pen/gOpRPV", "raurir/pen/KKovNY", "jscottsmith/pen/KoEWzQ", "raurir/pen/wvXGjV", "pouretrebelle/pen/ZBNJmd", "raurir/pen/pjaEbj", "GabbeV/pen/DMRPox", "jencrosby/pen/NWxZOyX", "bcdevlucas/pen/YooJBO", "AlexTaietti/pen/yMZPZj", "darrylhuffman/pen/KWvvEW", "darrylhuffman/pen/JEdWzp", "darrylhuffman/pen/qmPvaj", "shubniggurath/pen/ppOgPW", "shubniggurath/pen/MGdMbo", "zadvorsky/pen/MaVXPQ", "teolitto/pen/KwOVvL", "stivaliserna/pen/rNMwpaG", "strangerintheq/pen/NWPgpRK", "al-ro/pen/dEmvyy", "al-ro/pen/rgjazb", "al-ro/pen/xNRrjB", "al-ro/pen/MdJgqe", "al-ro/pen/oNvdRew", "soju22/pen/JzzvbR", "ClementRoche/pen/NeaXoz", "JuanFuentes/pen/QYooEw", "trajektorijus/pen/qBOqBaj", "JuanFuentes/pen/jvBBjP", "trajektorijus/pen/mdeBYrX", "antoniasymeonidou/pen/eYdyGmv", "antoniasymeonidou/pen/ExwJdPd", "antoniasymeonidou/pen/jOLxBjN", "remid/pen/OgYjYV", "giaco/pen/jOOGjPE", "giaco/pen/xWRmqv", "TomHinton/pen/zYRxYZK", "giaco/pen/MWKgNJP", "nikrowell/pen/dgeoxW", "Dillo/pen/NWqXBJE", "alexandrix/pen/OrpdNJ", "PullJosh/pen/qOWdKe", "tmrDevelops/pen/vLKERZ", "makecodenotwar/pen/bqpVbY", "gmoyer/pen/pPQdEM", "PullJosh/pen/qOWdKe", "kadircimenyemez/pen/oKZNJq", "giaco/pen/BbpKZy", "F5/pen/QEKVXq", "creativeocean/pen/OJygyPR", "ma_suwa/pen/oNgVQJa", "wvnl/pen/GYgWwJ", "cathbailh/pen/bGGjPXo", "stufreen/pen/KOWKBw", "Tibixx/pen/dBMggW", "learosema/pen/arPVoR", "supah/pen/BqREob", "shubniggurath/pen/XGpBxQ", "ashthornton/pen/MzdoQo", "JuanFuentes/pen/ZEzmBoj", "electricgarden/pen/rNNyKWY", "JuanFuentes/pen/XWdOjMM","jaredstanley/pen/RwywQzG" ]


function replaceTerm(Backgrounds1) { return Backgrounds1.map(function(element) { // Replace the term "/pen/" with "/full/" 
  return element.replace("/pen/", "/full/"); }); }

const Backgrounds2 = replaceTerm(Backgrounds1);

/*for (var i = 0; i < Backgrounds1.length; i++) {
  
var abcdef = Backgrounds1[i];
  
  let a = document.getElementById('main')

  a.innerHTML = a.innerHTML + '<figure id="open-modal' + i + '" class="modal__button"  style="background-image: url(https://shots.codepen.io/' + abcdef + '-800.jpg)"></figure><div class="modal__container modal-container close-modal" id="modal-container' + i + '"><div class="modal__content"><div class="modal__close close-modal" title="Close"><i class="bx bx-x"></i></div><div class="iframe-head"><h5>Animated backgrounds</h5></div><iframe src="https://codepen.io/' + abcdef + '" style="border:0px #ffffff none;" name="myiFrame" frameborder="1" height="400px" class="modal__img" ></iframe><h1 class="modal__title">Good Job!</h1><button class="modal__button modal__button-width">View status</button><button class="modal__button-link close-modal">Close</button></div></div></div>';
 
}*/

const itemsPerPage = 11; // Number of items to display per page
let currentPage = 0; // The current page being displayed

function displayPage(page) {
  // Clear the current page
  document.getElementById("main").innerHTML = "";

  // Calculate the starting and ending indices for the current page
  const startIndex = page * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Loop through the array and display the elements for the current page
  for (let i = startIndex; i < endIndex; i++) {
    if (i >= Backgrounds1.length) {
      break;
    }

    // Append the element to the page
    let a = document.getElementById("main")

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
  
const arrayContainer = document.getElementById("main"); // Scroll the array container into view 
  
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




























const s = document.querySelector('.Subscribe')
const b = document.querySelector('button')
b.addEventListener('click', (e) => {
  e.preventDefault()
  s.classList.toggle('Subscribe--loading')
  setTimeout(() => {
     s.classList.remove('Subscribe--loading')
     s.classList.toggle('Subscribe--complete')
  }, 2000)
  
  setTimeout(() => {
     s.classList.remove('Subscribe--complete')
  }, 5000)
})

class Subscribe extends React.Component {
  render() {
    return (
      <div>Subscribe</div>
    )
  }
}

// ReactDOM.render(
//   <Subscribe />,
//   document.getElementById('subscribe')
// )



  
  
  




