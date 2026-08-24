// Referencia global ao NavigationContainer.
// Permite que o api.js redirecione para Login em caso de sessao expirada
// sem precisar do prop navigation em cada tela.
import { createNavigationContainerRef } from '@react-navigation/native';

export const navRef = createNavigationContainerRef();
