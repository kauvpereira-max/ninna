<#
.SYNOPSIS
Confere que um secret do Supabase tem o valor que você acha que tem — sem o
valor passar por lugar nenhum além do seu terminal.

.EXAMPLE
.\scripts\conferir-secret.ps1 STRIPE_WEBHOOK_SECRET

Ele pede o valor SEM ecoar na tela, calcula o SHA-256 local, lê o digest do
servidor e compara. A saída não contém segredo: pode colar no chat inteira.

.NOTES
POR QUE EXISTE UM GÊMEO EM POWERSHELL

O `conferir-secret.sh` foi escrito e provado, e mesmo assim não foi usado três
vezes seguidas em 12/08/2026 — porque o terminal deste projeto é PowerShell, e
PowerShell não executa `.sh`. O script certo, no shell errado, é um script que
não existe.

É o mesmo raciocínio do original, um nível abaixo: não adianta o caminho seguro
ser curto se ele não abre. Os dois ficam, porque os dois shells são usados aqui
(o Git Bash roda os testes).

O DIGEST É SHA-256 DO VALOR CRU

Sem `\n` no fim — por isso os bytes UTF-8 da string, e nunca algo que escreva
linha. Calibrado em 12/08/2026 contra os dois `price_id`, que são públicos e
podiam ser calculados dos dois lados.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Nome,

  [Parameter(Position = 1)]
  [string]$Projeto = 'hzjcimgutccsfrxuuhrl'
)

$ErrorActionPreference = 'Stop'

# -AsSecureString para o valor não aparecer na tela nem no histórico do shell.
$seguro = Read-Host -Prompt "Cole o valor de $Nome (não aparece na tela)" -AsSecureString

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
try {
  $valor = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrEmpty($valor)) {
  Write-Error 'vazio — nada a conferir.'
  exit 1
}

$sha = [System.Security.Cryptography.SHA256]::Create()
try {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($valor)
  $local = ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
} finally {
  $sha.Dispose()
}

$valor = $null
$bytes = $null
[System.GC]::Collect()

$bruto = & npx --yes supabase secrets list --project-ref $Projeto --output json
$j = ($bruto -join "`n") | ConvertFrom-Json

# O CLI já devolveu as duas formas: array puro e objeto com `.secrets` dentro.
# Aceitar as duas custa uma linha e evita que uma atualização do CLI quebre a
# conferência bem no dia em que ela mais importa.
if ($j.PSObject.Properties.Name -contains 'secrets') { $lista = $j.secrets } else { $lista = $j }

$achado = $lista | Where-Object { $_.name -eq $Nome }
if ($null -eq $achado) { $servidor = 'AUSENTE' } else { $servidor = $achado.value }

Write-Output "secret    : $Nome"
Write-Output "local     : $local"
Write-Output "servidor  : $servidor"

if ($local -eq $servidor) {
  Write-Output 'resultado : BATE'
  exit 0
}

Write-Output 'resultado : NAO BATE'
Write-Output ''
Write-Output 'Se você acabou de gravar, confira o espaço antes de --project-ref:'
Write-Output '  ...VALOR --project-ref ...   e nunca   ...VALOR--project-ref ...'
Write-Output "Sem o espaço, o valor gravado leva '--project-ref' colado no fim e o"
Write-Output "comando ainda responde 'Finished supabase secrets set.'"
exit 1
