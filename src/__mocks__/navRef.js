// Mock do navRef para evitar dependencia de react-navigation nos testes
export const navRef = {
  isReady: jest.fn(() => false),
  reset: jest.fn(),
  navigate: jest.fn(),
};
