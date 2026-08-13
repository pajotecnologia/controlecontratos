$source = "c:\Users\AdminUser\Documentos\PROJETOS_SISTEMAS\ControleComissoes\server"
$dest = "c:\Users\AdminUser\Documentos\PROJETOS_SISTEMAS\ControleComissoes\pacote_vps"
$zipFile = "c:\Users\AdminUser\Documentos\PROJETOS_SISTEMAS\ControleComissoes\pacote_vps.zip"

if (Test-Path $dest) {
    Remove-Item -Recurse -Force "$dest\*" -ErrorAction SilentlyContinue
} else {
    New-Item -ItemType Directory -Path $dest
}

# Wait for rebuild-frontend to finish (it copies dist to server/public)
# Assuming it will be finished by the time we run this or we run this AFTER.

Copy-Item -Path "$source\*" -Destination $dest -Recurse -Force

$unwanted = @("node_modules", "uploads", ".env", "add_observacoes.js")
foreach ($u in $unwanted) {
    $p = Join-Path $dest $u
    if (Test-Path $p) {
        Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue
    }
}

Copy-Item "c:\Users\AdminUser\Documentos\PROJETOS_SISTEMAS\ControleComissoes\dump_banco.sql" -Destination $dest -Force
Copy-Item "c:\Users\AdminUser\Documentos\PROJETOS_SISTEMAS\ControleComissoes\DEPLOY_VPS.md" -Destination $dest -Force

if (Test-Path $zipFile) {
    Remove-Item -Force $zipFile
}
Compress-Archive -Path "$dest\*" -DestinationPath $zipFile

Write-Host "Pacote VPS gerado com sucesso!"
