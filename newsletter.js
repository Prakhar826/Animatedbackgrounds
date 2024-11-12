
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
