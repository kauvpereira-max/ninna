#!/usr/bin/env bash
#
# Confere que um secret do Supabase tem o valor que você acha que tem —
# sem o valor passar por lugar nenhum além do seu terminal.
#
#   ./scripts/conferir-secret.sh STRIPE_WEBHOOK_SECRET
#
# Ele pede o valor SEM ecoar na tela, calcula o SHA-256 local, lê o digest do
# servidor e compara. A saída não contém segredo: pode colar no chat inteira.
#
# ------------------------------------------------------------------
# POR QUE ISTO EXISTE
#
# Em 12/08/2026, três chaves da Stripe foram coladas num chat em sequência,
# cada uma depois de a anterior ter sido rolada por causa da exposição. O
# conselho estava certo e não adiantou: o caminho seguro era mais trabalhoso
# que o inseguro.
#
# Isto não é um lembrete. É o caminho seguro sendo o mais curto.
#
# ------------------------------------------------------------------
# O DIGEST É SHA-256 DO VALOR CRU, E ISSO FOI PROVADO
#
# Não é suposição: em 12/08/2026 os dois `price_id` — que são públicos, então
# podiam ser calculados dos dois lados — bateram exatamente com o que o
# `secrets list` devolve. A régua foi calibrada num valor conhecido antes de
# ser usada num desconhecido.
#
# Sem `\n` no fim: por isso `printf '%s'`, e nunca `echo`.

set -euo pipefail

NOME="${1:-}"
PROJETO="${2:-hzjcimgutccsfrxuuhrl}"

if [ -z "$NOME" ]; then
  echo "uso: $0 NOME_DO_SECRET [project-ref]" >&2
  echo "ex.: $0 STRIPE_WEBHOOK_SECRET" >&2
  exit 1
fi

printf 'Cole o valor de %s (não aparece na tela): ' "$NOME" >&2
read -rs VALOR
printf '\n' >&2

if [ -z "$VALOR" ]; then
  echo "vazio — nada a conferir." >&2
  exit 1
fi

LOCAL=$(printf '%s' "$VALOR" | sha256sum | cut -d' ' -f1)
unset VALOR

SERVIDOR=$(npx --yes supabase secrets list --project-ref "$PROJETO" \
  | node -e "
      let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
        const j=JSON.parse(s);
        const achado=j.secrets.find(x=>x.name===process.argv[1]);
        console.log(achado ? achado.value : 'AUSENTE');
      });" "$NOME")

echo "secret    : $NOME"
echo "local     : $LOCAL"
echo "servidor  : $SERVIDOR"

if [ "$LOCAL" = "$SERVIDOR" ]; then
  echo "resultado : BATE"
else
  echo "resultado : NAO BATE"
  echo ""
  echo "Se você acabou de gravar, confira o espaço antes de --project-ref:"
  echo "  ...VALOR --project-ref ...   e nunca   ...VALOR--project-ref ..."
  echo "Sem o espaço, o valor gravado leva '--project-ref' colado no fim e o"
  echo "comando ainda responde 'Finished supabase secrets set.'"
  exit 1
fi
