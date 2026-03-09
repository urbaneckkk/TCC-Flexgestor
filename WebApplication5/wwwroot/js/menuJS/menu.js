
  // Seleciona todos os itens que têm submenu
  const menusComSub = document.querySelectorAll('.sidebar .menu-relatorios');

  menusComSub.forEach(menu => {
    const toggle = menu.querySelector('span'); // item clicável
    const submenu = menu.querySelector('.submenu'); // submenu interno

    toggle.addEventListener('click', () => {
      // Alterna classe ativa
      menu.classList.toggle('active');

      // Abre ou fecha o submenu suavemente
      if (submenu.style.maxHeight) {
        submenu.style.maxHeight = null; // fecha submenu
      } else {
        submenu.style.maxHeight = submenu.scrollHeight + "px"; // abre submenu
      }
    });
  });

 