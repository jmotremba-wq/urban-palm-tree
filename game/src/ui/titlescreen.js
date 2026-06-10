// titlescreen.js
// Wires the #title DOM overlay: New Game / Continue buttons. "Continue" is
// disabled when there is no existing save. The game shows/hides this overlay by
// toggling the `show` class.

export function setupTitle({ hadSave, onNew, onContinue }) {
  const title = document.getElementById("title");
  const btnNew = document.getElementById("btn-new");
  const btnContinue = document.getElementById("btn-continue");

  if (btnContinue) {
    btnContinue.disabled = !hadSave;
    btnContinue.addEventListener("click", onContinue);
  }
  if (btnNew) btnNew.addEventListener("click", onNew);

  return {
    show() {
      if (title) title.classList.add("show");
    },
    hide() {
      if (title) title.classList.remove("show");
    },
  };
}
