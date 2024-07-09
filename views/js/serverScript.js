// for each button clicked, render the smoothies in that category
let fitnessButton = document.getElementById("fitnessButton");
fitnessButton.addEventListener("click", function () {
  window.location.href = "/fitness";
});

let weightLossButton = document.getElementById("weightLossButton");
weightLossButton.addEventListener("click", function () {
  window.location.href = "/weightloss";
});

let beWellButton = document.getElementById("beWellButton");
beWellButton.addEventListener("click", function () {
  window.location.href = "/bewell";
});

let treatButton = document.getElementById("treatButton");
treatButton.addEventListener("click", function () {
  window.location.href = "/treat";
});
