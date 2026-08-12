# Templates de e-mail da autenticação

Os três arquivos deste diretório são o **conteúdo** dos templates de auth do
Supabase. Eles moram no painel, e por isso valem as duas regras de sempre.

---

## Por que eles estão versionados aqui se moram no painel

Porque é copy que a mãe lê, e copy que só existe num painel não passa por
revisão, não aparece em diff, e não tem como ser varrida pelos testes de tom.

E porque é **regra nº 1**: configuração de painel se confere pelo servidor, nunca
pela tela. O arquivo no repositório é o que se pretendia; o e-mail entregue é o
que aconteceu. Os dois precisam ser comparados de vez em quando, e a comparação
não é automática.

⚠️ **Editar aqui não muda nada em produção.** Colar no painel é um passo à parte,
e é o passo que se esquece.

---

## Onde colar

`Dashboard → Authentication → Emails → Templates`, projeto `hzjcimgutccsfrxuuhrl`.

| Arquivo | Template no painel | Está em uso? |
|---|---|---|
| `recuperar-senha.html` | **Reset Password** | **Sim** — é o único que dispara hoje |
| `confirmar-cadastro.html` | **Confirm signup** | Não. Dorme porque "Confirm email" está desligado (`mailer_autoconfirm: true`) |
| `trocar-email.html` | **Change Email Address** | Não. O app ainda não deixa trocar e-mail |

**Os dois dormentes estão escritos de propósito.** Ligar "Confirm email" é um
toque no painel, e sem isto o primeiro e-mail que a mãe receberia estaria em
inglês — que é exatamente o estado em que o *Reset Password* foi encontrado.

Cada template tem um **Subject** próprio, num campo separado do corpo:

| Template | Subject |
|---|---|
| Reset Password | `Redefinir sua senha na Ninna` |
| Confirm signup | `Confirme seu e-mail na Ninna` |
| Change Email Address | `Confirme seu novo e-mail na Ninna` |

---

## As decisões de copy, e por que cada uma

**Português, e não o padrão em inglês.** O e-mail que estava no ar dizia *"Reset
your password — We received a request…"*. Para uma mãe brasileira num app PT-BR,
e-mail em inglês soa golpe — e o filtro do Gmail lê o mesmo sinal que ela.

**Diz o prazo do link.** "Vale por 1 hora" evita o suporte mais previsível que
existe: ela clica no dia seguinte, cai em "link expirado" e acha que o app
quebrou. Foi o que aconteceu no teste do D3b.

**Diz o que fazer se não foi ela.** "Pode ignorar, sua senha continua a mesma"
tira o susto de quem recebe um e-mail de senha sem ter pedido. No de trocar
e-mail o conselho é outro, e mais duro: se não foi ela, **alguém com acesso à
conta pediu** — e aí trocar a senha é a ação certa.

**Assinatura com o nome e o endereço do app.** Não é enfeite: e-mail
transacional sem identidade do remetente é padrão de phishing, e tanto a mãe
quanto o filtro pontuam isso.

**Sem imagem, sem botão de CSS, sem rastreamento.** HTML mínimo entrega melhor,
carrega em qualquer cliente, e não pede que ela confie num link escondido atrás
de um botão. O texto do link diz o que ele faz — "Escolher uma nova senha", não
"clique aqui".

**Sem "você" formal, sem exclamação em excesso, sem urgência.** Quem lê pode
estar acordada às 3h com um bebê no colo. A mesma régua da copy do app.

---

## Como conferir que foi para produção

Não existe endpoint que devolva os templates — `/auth/v1/settings` não os
carrega, do mesmo jeito que não carrega o SMTP. **A conferência é o e-mail
entregue.**

1. No app, pedir "esqueci minha senha" para uma conta que exista;
2. Abrir o e-mail e comparar com `recuperar-senha.html`;
3. Conferir que o link abre `ninna-sigma.vercel.app/nova-senha`.

⚠️ **Cuidado com o intervalo mínimo:** o SMTP está com `Minimum interval per
user: 60`, então dois pedidos seguidos para o mesmo e-mail em menos de um minuto
não geram o segundo envio.

---

## O que continua valendo depois disto

**Reputação de domínio novo leva tempo e volume.** Templates em português e bem
formados ajudam, mas não substituem histórico de envio. Cair no spam nos
primeiros envios não é falha de configuração — ver `BETA.md` §11.2.
