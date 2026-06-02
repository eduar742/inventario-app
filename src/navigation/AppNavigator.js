// Sistema de navegacao entre telas do app.

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen               from '../screens/LoginScreen';
import HomeScreen                from '../screens/HomeScreen';
import LojasScreen               from '../screens/LojasScreen';
import SessoesScreen             from '../screens/SessoesScreen';
import ScannerScreen             from '../screens/ScannerScreen';
import ContagemScreen            from '../screens/ContagemScreen';
import ResumoScreen              from '../screens/ResumoScreen';
import ImportacaoScreen          from '../screens/ImportacaoScreen';
import HistoricoImportacoesScreen from '../screens/HistoricoImportacoesScreen';
import ExportarRelatorioScreen   from '../screens/ExportarRelatorioScreen';
import CriarSessaoScreen         from '../screens/CriarSessaoScreen';
import GestoresScreen            from '../screens/GestoresScreen';
import DashboardScreen           from '../screens/DashboardScreen';
import DashboardLojasScreen, { DashboardHistoricoScreen } from '../screens/DashboardLojasScreen';
import DivergenciasScreen              from '../screens/DivergenciasScreen';
import HistoricoContagensScreen        from '../screens/HistoricoContagensScreen';
import RelatorioConsolidadoScreen        from '../screens/RelatorioConsolidadoScreen';
import DashboardConsolidadoScreen        from '../screens/DashboardConsolidadoScreen';

import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

const opcoesHeader = {
  headerStyle:      { backgroundColor: colors.primary },
  headerTintColor:  colors.white,
  headerTitleStyle: { fontWeight: '600' },
  headerBackTitleVisible: false,
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={opcoesHeader}>

        <Stack.Screen name="Login"    component={LoginScreen}   options={{ headerShown: false }} />
        <Stack.Screen name="Home"     component={HomeScreen}    options={{ headerShown: false }} />
        <Stack.Screen name="Lojas"    component={LojasScreen}   options={{ title: 'Selecione a loja' }} />
        <Stack.Screen name="Sessoes"  component={SessoesScreen} options={{ title: 'Sessoes' }} />
        <Stack.Screen name="Scanner"  component={ScannerScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Contagem" component={ContagemScreen} options={{ title: 'Contagem do produto' }} />
        <Stack.Screen name="Resumo"   component={ResumoScreen}  options={{ title: 'Resumo do inventario' }} />

        {/* Importacao */}
        <Stack.Screen name="Importacao"          component={ImportacaoScreen}           options={{ title: 'Importar planilha' }} />
        <Stack.Screen name="HistoricoImportacoes" component={HistoricoImportacoesScreen} options={{ title: 'Historico de importacoes' }} />

        {/* Exportacao */}
        <Stack.Screen name="ExportarRelatorio" component={ExportarRelatorioScreen} options={{ title: 'Exportar relatorio' }} />

        {/* Gestao (ADM) */}
        <Stack.Screen name="CriarSessao" component={CriarSessaoScreen} options={{ title: 'Nova sessao' }} />
        <Stack.Screen name="Gestores"    component={GestoresScreen}    options={{ title: 'Usuarios' }} />

        {/* Dashboard */}
        <Stack.Screen name="Dashboard"          component={DashboardScreen}          options={{ title: 'Dashboard' }} />
        <Stack.Screen name="DashboardLojas"     component={DashboardLojasScreen}     options={{ title: 'Dashboard por loja' }} />
        <Stack.Screen name="DashboardHistorico" component={DashboardHistoricoScreen} options={({ route }) => ({ title: route.params?.loja?.codigo || 'Historico' })} />

        {/* Pos-inventario */}
        <Stack.Screen name="Divergencias"            component={DivergenciasScreen}           options={{ title: 'Divergencias' }} />
        <Stack.Screen name="HistoricoContagens"      component={HistoricoContagensScreen}      options={{ title: 'Historico de contagens' }} />
        <Stack.Screen name="RelatorioConsolidado"    component={RelatorioConsolidadoScreen}    options={{ title: 'Relatorio Geral' }} />
        <Stack.Screen name="DashboardConsolidado"   component={DashboardConsolidadoScreen}    options={{ title: 'Dashboard Consolidado' }} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
