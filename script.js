


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


let Backgrounds1 =["wvadazR", "LYjvEJj", "LYNxoVd", "BEKdjd", "BRVepM", "BWMyZr", "AjKKVz", "AmqdWE", "BXKxxP", "BYbjyg", "BaJOPMK", "BaJmaXy", "BaLBQgo", "BaaNKqj", "BaamKgv", "BamepLe", "BawLgLE", "BawgOGE", "BbpKZy", "BgMxQE", "BmyyOQ", "BpjPKj", "BqREob", "BrRXJo", "BvXdLm", "AJMvQE", "ALgaeV", "AZedgK", "BxMQYQ", "ByVyzb", "BzJZQv", "BzVmVw", "BzjXdd", "DKLNwo", "DMRPox", "DZaedO", "DbpBKB", "DeJedo", "DeyVmJ", "DjoXVM", "DpNRyR", "DqXMvK", "EVEgJb", "EVeGoJ", "EXmOaB", "EaKZKL", "ExKZBLB", "ExLawGG", "ExVLJQv", "ExaEprE", "ExjxvxY", "ExoZNwe", "ExwJdPd", "ExyPMLJ", "Exyewjv", "ExzZpO", "EyZgLo", "EymwRL", "GJVOVw", "GNYvbZ", "GREgaVx", "GRNmdzB", "GROYrOy", "GRQMzBa", "GRXBYa", "GRZayyO", "GRdBVZm", "GRjLymN", "GRoNyqr", "GRoZYZb", "GRowVvx", "GRpRoZe", "GRxbdzN", "GYgWwJ", "GZoKYO", "Gamrrw", "GapgVq", "GeWEZg", "GoQMQx", "GpoXRJ", "GvRNpG", "GywGLW", "JEMovg", "JEdWzp", "JEdYGP", "JGXVaR", "JGvyra", "JKXpzy", "JKYXLL", "JXbYdz", "JXwPrw", "JYYbXW", "JbeVBZ", "JbjryL", "JdegNE", "JjEqebK", "JjLKwRJ", "JjOPZGN", "JjOYmxG", "JjQXdZO", "JjRpdaB", "JjdegRO", "JjojgWw", "JjpgBwY", "JjvQOXx", "JrROLJ", "JzzvbR", "KBMyjE", "KGjKMr", "KJWXxE", "KKMWRwp", "KKMdrdQ", "KKWzpRx", "KKgazXp", "KKovNY", "KKovmGb", "KKoyEKe", "KKyVOpw", "KOWKBw", "KVavPN", "KWvvEW", "KdwYej", "KeJegx", "KoEWzQ", "KpQvBY", "KwOVvL", "KzKBPN", "KzbPyv", "LEPjQML", "LKgROw", "LKgpOr", "LNeXZP", "LQVzxJ", "LVvaNQ", "LYNOYRL", "LYNxoVd", "LYPMpNE", "LYQKWqJ", "LYjvEJj", "MGdMbo", "MKVZjv", "MWExRMQ", "MWKgNJP", "MWVZJoZ", "MWaERJq", "MWbXgpp", "MWgZdbp", "MWgxYYL", "MWoeERO", "MWvgddV", "MWybmKE", "MYGKyj", "MZXQNV", "MaRqwd", "MaVXPQ", "MbNWXp", "MdJgqe", "MoWBze", "MpYagK", "Mprdaa", "MqRyWJ", "MwdMdp", "MzdoQo", "NLRxvN", "NRvweO", "NWNNEgZ", "NWPgpRK", "NWYYOEq", "NWYwWRB", "NWaMgpO", "NWgYRrv", "NWqXBJE", "NWxZOyX", "NWyxRyV", "NeaXoz", "NxoZBq", "NxqMJN", "NywxRg", "OJKqRXp", "OJPBmKR", "OJQJYbg", "OJVRRGJ", "OJjWWJR", "OJygyPR", "OMLrGm", "OOrBXo", "OPGemQ", "OQQPmy", "ORbjPb", "OWBZEz", "OgYjYV", "OgagYW", "OjjPBN", "OjwBEQ", "OrpdNJ", "OymRRQ", "PEyEmY", "PEzWMx", "PGdrZp", "PMpEQo", "PPYXyr", "PPdBYL", "Pjbreg", "PmVJRG", "PoOpXzN", "PoPJqvM", "PoYgvYQ", "PooeNeN", "PpbpMB", "PqxKXg", "PwWxRd", "QEKVXq", "QGoNOE", "QKdVMM", "QMwObb", "QNpBvE", "QRRbEV", "QWGdZJ", "QWQjjNx", "QWWbNpN", "QWWdMVy", "QWbOwdy", "QWjMPpB", "QWjZKZJ", "QWmPzja", "QWqQeoq", "QWyJmda", "QWyNMoj", "QYooEw", "QZBLpg", "Qbzmzr", "QjJvxZ", "QpbyGd", "QqRxQN", "QrPBYm", "QvbEKp", "QwLzQp", "REOZLY", "RNbZQzJ", "RRLWod", "RVjGYN", "RWLbEy", "RWwoeP", "RaJmyx", "RgYXmJ", "RmNMdz", "RmRJgm", "RrNzKL", "RwPGvJN", "RwWXLmz", "RwywQzG", "VGyXEX", "VLxomo", "VRLoLw", "VYZayjR", "VbeyZO", "VmJjaG", "Vmpzwe", "VqjvqR", "VrdYxN", "VwKQENg", "VwQwrMx", "VwXWNYg", "VwZRrRL", "VwjYqRR", "VwvLxYW", "VwxOZBJ", "Vxbder", "VyaxjE", "WNGYgQm", "WNJNRqB", "WNJOOJX", "WNJqxYz", "WNLVdN", "WNZxOOx", "WNbgvNx", "WNzJOmE", "WVOXKa", "WVpwbE", "WWRoeO", "WdZLyG", "WvEwej", "WwxGeB", "WxNVoq", "Wyoomm", "XBBBjd", "XGpBxQ", "XWVdpP", "XWZmmEJ", "XWadajZ", "XWbXgRp", "XWdOjMM", "XWpMONO", "XWwQKO", "XXLQVp", "XZNROr", "XgpNwb", "XmYXOK", "XvXBbP", "XyOaBj", "YGPBep", "YNPdRR", "YParZw", "YPyoVX", "YXRRPP", "YXarjv", "YXgBOL", "YXvNBB", "YZdBQO", "YaQBdW", "YooJBO", "YpQLPm", "YwqNjw", "YyvbaO", "YzGrEOE", "YzKLpZe", "YzVqzZM", "YzXOGpm", "YzXrjZE", "YzePgPV", "YzwZvMY", "YzxEBpP", "ZBNJmd", "ZBVdEq", "ZEGYqop", "ZEWEaVZ", "ZEeeWeW", "ZEpJBNd", "ZEpLYP", "ZEzmBoj", "ZKqLWW", "ZVewby", "ZYMJpd", "ZeWeoB", "ZmErQQ", "ZmvGGJ", "ZqbVVL", "ZqbvxB", "ZreVmL", "ZrqGZe", "ZrxmrE", "ZvgNVg", "Zvpwvv", "aGmoae", "aGorVj", "aNJRgL", "aWzJgW", "aaEZaw", "abGGKOY", "abVjOpo", "abWopXy", "abYPGbN", "abZmoeL", "abqGjVp", "abvGdYq", "abvZEKg", "abvxwGN", "adMzWQ", "adrGqq", "aeRxxB", "aqqPBq", "arPVoR", "bEOzaz", "bGEQXgm", "bGGZWEw", "bGGjPXo", "bGLwpoJ", "bGMdMEj", "bGYrZBj", "bGdbmwN", "bGqpNop", "bRvxMw", "bVmVrG", "bWbxWy", "bYOeEE", "bYmgaY", "bdLGgg", "bdypYx", "bjmLjR", "bmBodM", "bpLPxo", "bqBvRe", "bqpVbY", "dBMggW", "dEmvyy", "dNQpQX", "dOLgWm", "dVqGNG", "dXwEaO", "dYmgmL", "dYxGrO", "dZQOMm", "dgXGdv", "dgeoxW", "doLyyK", "dpNXbd", "dppgOZ", "dvBwVw", "dyOqoOZ", "dyPorwJ", "dyVZEQd", "dyZWRxa", "dyZYqdr", "dymqrwe", "dymwPjK", "dypZQGo", "dyybMq", "eKJBwV", "eNPPOG", "eNQLyZ", "eNXRLr", "eNbVVE", "eNePwK", "eYGgbJv", "eYOegjY", "eYOgYwx", "eYXpNL", "eYZqWpq", "eYdxOzv", "eYdyGmv", "eYgQrga", "eYwaem", "eYyQyq", "eYzdogK", "edbYwb", "ejgJqm", "emazBa", "ezZXzg", "ezvzLq", "gMOPqY", "gMYEaG", "gONYmNM", "gOXRGGR", "gOpRPV", "gOvmJxg", "gPOdxb", "gaRPbg", "gbYMVyp", "gbvqBo", "gdVObN", "ggqQMK", "gjgyKx", "gvvVvY", "gwvVpP", "gyxrVp", "gzxXLq", "jOLxBjN", "jOOGjPE", "jOOjeMO", "jOWJKyR", "jOWMGON", "jOajyYE", "jObpoWP", "jOqPpmB", "jOrEqq", "jVrwzo", "jXbWaJ", "jYqwWJ", "jaXyZw", "jjjxMx", "jmbGNd", "jogeNm", "jqwYva", "jvBBjP", "jvJLZP", "jzRONO", "kBdjqa", "kGPoaB", "kawJWE", "kxgzgZ", "kyOdeK", "mBwQmd", "mBzqRv", "mEZvrG", "mJLeBY", "mJWLVJ", "mOLGgX", "mRVLzp", "mWZBgM", "mXEKaL", "mdMPjpG", "mdbOYyj", "mdbRKgg", "mdbpJWN", "mdeBYrX", "mdmKRpW", "nLLNeY", "nMadjQ", "nQRxBV", "nmexZj", "nrOwPL", "oBJWqZ", "oERMJz", "oKZNJq", "oNEBYqY", "oNGvvXb", "oNdaobM", "oNgVQJa", "oNgVdPg", "oNqRVyQ", "oNvdRew", "oNwEadp", "oNxVvEO", "oNyrGmb", "oPGyQw", "oRZLbd", "oXmEPM", "oXmgJe", "obZZVR", "oePeNy", "ogGpZb", "ogvLEwg", "ojwaME", "oxaXdj", "oxxmjO", "ozqXxY", "pBQEpx", "pBrMNQ", "pMWgjG", "pPQdEM", "pbJqOz", "pbjWwg", "pejopv", "pjaEbj", "pjzmve", "pmQJgR", "poVovBP", "podGpLB", "podZLBy", "popvreX", "powzLKr", "poyMNvG", "ppOgPW", "prrzVQ", "qBOqBaj", "qBprOEz", "qByrdxY", "qEJmBm", "qEWbGLr", "qOWdKe", "qdvqQx", "qmPvaj", "qqgvZe", "qvrMbd", "rGPqRb", "rMgKYR", "rNJapLz", "rNMwpaG", "rNNyKWY", "rNOEmQd", "rNWpmjP", "rNYamBX", "rNevLNK", "rNvLjmy", "rNvVmLw", "rNvZOpr", "rNxaVwN", "rNxyrQ", "rOQpKK", "rPYNLq", "rVPmaL", "rVZZzw", "rXMyWQ", "rYqMVN", "rappeK", "rgjazb", "rjOjBK", "rpvZYE", "rxjvxY", "vEvqZV", "vEweYM", "vGpErz", "vLKERZ", "vLgjKw", "vOPZBv", "vOYmxd", "vYLGRgX", "vYLwVGK", "vYOxvPe", "vYQPOm", "vYReorP", "vYWzoMq", "vYXXWOE", "vYdOdrL", "vYrbzXL", "vwVMXR", "vyGzJM", "wGRLOm", "wKBQKo", "wKqyqY", "wZJqNK", "wajBPr", "wdQvOw", "wpGgXO", "wvPXzeg", "wvPwrNB", "wvXGjV", "wvadazR", "wvaydeM", "wvjLrRK", "wvmNja", "wvmZzvq", "wvvwWEO", "wvyBorP", "wzbEbo", "xNRrjB", "xNYMdr", "xNdvKW", "xNvWag", "xWRmqv", "xmpxjp", "xqzxRL", "xrYemN", "xwBYvN", "xxGqJxj", "xxPLdzK", "xxYgRK", "xxdOYWE", "xyrpQY", "yLKwgyo", "yLLmRQO", "yLPdEPQ", "yLPooEb", "yLVeLNg", "yLXLVom", "yLYMqJQ", "yLgYpWM", "yLveQOK", "yLyaJMz", "yLyaPJb", "yMZPZj", "yMqqWe", "yOmezz", "yRMwGY", "yRYOwq", "yXdLEW", "yXoQYp", "yaZLgb", "ygBgVL", "ygapbp", "ymRpPd", "ypWNOB", "yqwYVo", "zGNKOy", "zGmZXR", "zJbKNN", "zKBpmq", "zRPRwG", "zVKdGz", "zVXWqM", "zWjpqa", "zYBWMgd", "zYEazZO", "zYGvroM", "zYNbOZG", "zYQYMy", "zYREZmK", "zYRxYZK", "zYpzZwg", "zYqLxeG", "zYrPvob", "zYvEQpK", "zYxYYqw", "zdWzEL", "zvLJoX", "zvZjaB"]


// function replaceTerm(Backgrounds1) { return Backgrounds1.map(function(element) { // Replace the term "/pen/" with "/full/" 
//   return element.replace("/pen/", "/full/"); }); }

// const Backgrounds2 = replaceTerm(Backgrounds1);

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

    a.innerHTML = a.innerHTML + '<script async type="text/javascript" src="//cdn.carbonads.com/carbon.js?serve=CESI523J&placement=animatedbackgroundsme" id="_carbonads_js"> </script><button onclick="nextPage()" id="load-more" class="modal__button bg-button">Load More</button><figure id="open-modal' + i + '" class="modal__button"  style="background-image: url(https://shots.codepen.io/username/pen/' + Backgrounds1[i] + '-800.jpg)"></figure><div class="modal__container modal-container close-modal" id="modal-container' + i + '"><div class="modal__content"><div class="modal__close close-modal" title="Close"><i class="bx bx-x"></i></div><div class="iframe-head"><h5>Animated backgrounds</h5></div><iframe src="https://codepen.io/username/full/' + Backgrounds1[i] + '" style="border:0px #ffffff none;" name="myiFrame" loading="lazy" frameborder="1" height="400px" class="modal__img" ></iframe><a href="https://codepen.io/username/pen/'+ Backgrounds1[i] +'" target= "_blank"><button class="modal__button modal__button-width">Get Code</button></a><button class="modal__button-link close-modal">Close</button></div></div></div>';

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
