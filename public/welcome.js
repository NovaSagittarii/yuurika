function start(){
  joinGame(document.getElementById('input').value);
  document.getElementById('welcome').style.display = "none";
  document.getElementById('display').style.display = "block";
  joinGame = start = () => {};
}
document.addEventListener('keydown', (event) => {
  const keyName = event.key;
  if(keyName === 'Enter') start();
});
