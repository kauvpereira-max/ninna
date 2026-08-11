# Teste manual — o contador do sono avança sozinho?

**Pendente desde 11/08/2026.** Cinco minutos de trabalho, e nenhum teste
automatizado o substitui.

---

## Por que ele não pode ser automatizado

O contador do sono em andamento depende de um `setInterval` de 30s
(`src/hooks/useAgoraTick.ts`) rodando dentro do navegador da mãe. A cadeia
inteira é pura e testada — `resumirSonoEmAndamento` tem asserção nas duas bordas
do primeiro minuto, e `emAndamento` é a mesma condição que mostra o botão
"Encerrar" —, mas nada disso prova que o **timer** dispara.

É regra 2b do `CLAUDE.md`: o teste roda no Node, e a falha mora no Safari.
Navegador estrangula `setInterval` em aba de fundo, em PWA instalada, e com a
tela apagada — cada um com regra própria, nenhuma delas presente no Node.

---

## O que se observou, e as duas hipóteses

Em 11/08/2026, na virada para a tabela `registros`, a Home mostrou "Dormindo
agora" e só virou contador **depois de recarregar a página**.

Havia duas explicações, e elas pediam correções opostas:

| Hipótese | O que estaria acontecendo |
|---|---|
| **O limiar** | O texto só virava contador aos 2 minutos, e o tick de 30s empurrava isso para até 2min30s. Nada quebrado — só uma janela longa demais parecendo tela travada. |
| **O timer** | O `setInterval` não dispara na PWA, e a tela só se atualiza quando algo mais a força a renderizar. |

**O limiar já foi corrigido** (contador anda desde o primeiro minuto), e isso
encurta a janela de 2min30s para no máximo ~1min30s. Se a causa era ele, o
sintoma desaparece.

**A hipótese do timer segue aberta**, e é ela que este teste resolve.

---

## O procedimento

Na **PWA instalada** — não na aba do Safari; são runtimes diferentes e é a
instalada que a mãe usa.

1. Abrir o app na Home.
2. Iniciar um sono.
3. **Não tocar em nada por 3 minutos.** Sem rolar, sem trocar de aba, sem apagar
   a tela. A tela precisa ficar acesa e o app em primeiro plano — apagar a tela
   testa outra coisa (e vale como segunda rodada, depois).
4. Ler o card do sono.
5. Encerrar o sono.

### Como ler o resultado

| O que aparece aos 3 minutos | Conclusão |
|---|---|
| "Dormindo há 2 min" ou "há 3 min" | **O timer funciona.** A causa era o limiar, e ele já foi corrigido. Assunto encerrado — apagar este arquivo. |
| Ainda "Dormindo agora", e vira contador ao recarregar | **O `setInterval` está sendo estrangulado.** É outro problema, e o conserto não é aqui: ver abaixo. |

---

## Se for o timer

O `useAgoraTick` não sobrevive ao ciclo de vida do navegador, e a saída não é um
intervalo mais curto — intervalo curto gasta bateria e continua sendo estrangulado.

O caminho é recalcular quando a página **volta a ser visível**, além de no
intervalo: `document.visibilitychange` e o `AppState` do React Native devolvem
esse gancho. O tick passa a ser a atualização fina, e a volta ao primeiro plano a
garantia de que o número não está velho.

Vale medir antes de escrever: `console.log` dentro do `setInterval` e conferir
pelo `read_console_messages` ou pelo inspetor do Safari se ele dispara de fato, e
com que espaçamento. Consertar timer sem ver o timer é adivinhar.

---

## O que este teste NÃO cobre

O sono que atravessa a madrugada com o telefone bloqueado. Ali o app é suspenso
de verdade, e nenhum intervalo roda — o número certo depois de 6 horas de tela
apagada depende de recalcular ao voltar, que é a mesma correção sugerida acima.
Se a rodada de 3 minutos passar, essa continua valendo a pena.
