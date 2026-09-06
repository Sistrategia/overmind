# Example only. Called BEFORE the site's existing publish/copy/deploy steps.
# No .deployment hook is installed by this migration. See docs/testing-handoff.md.
param(
    [Parameter(Mandatory = $true)]
    [string] $ResultsDirectory
)
$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$results = [IO.Path]::GetFullPath($ResultsDirectory)
New-Item -ItemType Directory -Force -Path $results | Out-Null
$env:OVERMIND_TEST_RESULTS = Join-Path $results 'resources'
Push-Location $repository
try {
    # global.json selects the SDK; a runtime-only App Service installation is insufficient.
    & dotnet --version
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & dotnet restore Overmind.Tests.sln
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & dotnet build Overmind.Tests.sln -c Release --no-restore
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & dotnet test Overmind.Tests.sln -c Release --no-build --settings tests/audit.runsettings --logger 'trx;LogFileName=audit.trx' --results-directory $results
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
