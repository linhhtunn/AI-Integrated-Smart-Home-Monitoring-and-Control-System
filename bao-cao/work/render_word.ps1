param([Parameter(Mandatory=$true)][string]$InputDocx,[Parameter(Mandatory=$true)][string]$OutputPdf,[switch]$UpdateFields)
$ErrorActionPreference='Stop'
$word=$null
$document=$null
try {
  $word=New-Object -ComObject Word.Application
  $word.Visible=$false
  $word.DisplayAlerts=0
  $word.AutomationSecurity=3
  $source=(Resolve-Path -LiteralPath $InputDocx).Path
  $destination=[System.IO.Path]::GetFullPath($OutputPdf)
  $document=$word.Documents.Open($source,$false,(-not $UpdateFields.IsPresent))
  if($UpdateFields){
    $document.Repaginate()
    foreach($toc in $document.TablesOfContents){$toc.Update()}
    foreach($figures in $document.TablesOfFigures){$figures.Update()}
    $document.Fields.Update() | Out-Null
    $document.Repaginate()
    foreach($toc in $document.TablesOfContents){$toc.UpdatePageNumbers()}
    $document.Save()
  }
  $document.ExportAsFixedFormat($destination,17)
  Write-Output ('PDF: '+$destination)
  Write-Output ('Pages: '+$document.ComputeStatistics(2))
} finally {
  if($document){$document.Close(0)}
  if($word){$word.Quit()}
}
