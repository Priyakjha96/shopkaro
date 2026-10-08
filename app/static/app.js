// Abhi sirf chips ka rang badalta hai. Asli data Stage 5 me API se aayega.
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
  });
});