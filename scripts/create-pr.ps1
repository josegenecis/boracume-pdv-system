<#
Create PR script (PowerShell)

Usage: run this script from the repository root. It will prompt you to paste
your GitHub Personal Access Token (hidden). The token is used only locally
to call the GitHub API and is not stored by this script.

Example:
  powershell -ExecutionPolicy Bypass -File .\scripts\create-pr.ps1

Required: token with `repo` scope (or `public_repo` for public repos).
#>

Write-Host "Criando PR: feat/auto-change-1776448635 -> main"

$token = Read-Host -AsSecureString "Cole seu GitHub Personal Access Token (será ocultado)"
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))

$bodyObj = @{
    title = "Melhora: prefetch de variações do cardápio e notificações persistentes"
    head  = "feat/auto-change-1776448635"
    base  = "main"
    body  = @"
Resumo: Prefetch das variações de produto para exibir complementos instantaneamente; fallback e alerta persistente para notificações sonoras quando audio.play() for bloqueado.

Arquivos alterados: src/hooks/useMenuData.ts, src/hooks/useProductVariations.ts, src/utils/soundUtils.ts

Como testar:
1. git checkout feat/auto-change-1776448635
2. npm run dev (ou yarn dev)
3. Abrir o menu e validar modal de complementos; verificar persistência do som de notificação.

Observações: sem migrations; depende de react-query e assets de som existentes.
"@
}

$body = $bodyObj | ConvertTo-Json -Depth 6

try {
    $response = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/josegenecis/boracume-pdv-system/pulls" -Headers @{ Authorization = "token $plain"; Accept = "application/vnd.github+json" } -Body $body -ContentType "application/json"
    Write-Host "PR criada com sucesso:" $response.html_url
}
catch {
    Write-Error "Falha ao criar PR: $($_.Exception.Message)"
    if ($_.Exception.Response -ne $null) {
        try { $content = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($content); $text = $reader.ReadToEnd(); Write-Host "Resposta da API:"; Write-Host $text } catch { }
    }
}

# cleanup
$plain = $null
Remove-Variable token -ErrorAction SilentlyContinue
