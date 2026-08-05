// Mesmo formulário do onboarding, alcançável por quem já tem bebê cadastrado.
//
// Precisa ser uma rota fora do grupo (onboarding) porque o RootNavigator devolve
// pras tabs qualquer um que entre naquele grupo já tendo bebê ativo — que é o
// comportamento certo pro fluxo de primeira vez, e o errado pra "cadastrar outro".

import CadastroBebeScreen from '../(onboarding)/cadastro-bebe';

export default function NovoBebeScreen() {
  return <CadastroBebeScreen contexto="adicional" />;
}
