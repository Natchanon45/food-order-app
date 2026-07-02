const receivedInput = document.querySelector("#receivedInput");
const confirmPaymentBtn = document.querySelector("#confirmPaymentBtn");

receivedInput?.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();

  if (!confirmPaymentBtn || confirmPaymentBtn.disabled) return;
  confirmPaymentBtn.click();
});
