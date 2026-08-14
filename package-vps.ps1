$source = "c:\Users\AdminUser\Documentos\PROJETOS_SISTEMAS\Contratos\server"
$dest = "c:\Users\AdminUser\Documentos\PROJETOS_SISTEMAS\Contratos\pacote_vps"
$zipFile = "c:\Users\AdminUser\Documentos\PROJETOS_SISTEMAS\Contratos\pacote_vps.zip"

if (Test-Path $dest) {
    Remove-Item -Recurse -Force "$dest\*" -ErrorAction SilentlyContinue
} else {
    New-Item -ItemType Directory -Path $dest
}

Get-ChildItem -Path $source -Exclude "node_modules", "uploads", ".env" | Copy-Item -Destination $dest -Recurse -Force

if (Test-Path $zipFile) {
    Remove-Item -Force $zipFile
}
Compress-Archive -Path "$dest\*" -DestinationPath $zipFile -Force

Write-Host "Pacote VPS gerado com sucesso!"
