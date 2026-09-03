export const safePrint = () => {
  const originalTitle = document.title;
  document.title = '\u200b'; // zero-width space
  window.print();
  document.title = originalTitle;
};
