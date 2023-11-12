function Get-DirectoryStructure {
  param (
      [Parameter(Mandatory=$true)]
      [string]$rootPath,
      [Parameter(Mandatory=$false)]
      [string]$indent = "",
      [Parameter(Mandatory=$false)]
      [string[]]$exemptFolders = @()
  )

  $items = Get-ChildItem -Path $rootPath

  foreach ($item in $items) {
      if ($item.PSIsContainer) {
          if ($exemptFolders -contains $item.Name) { continue }

          Write-Output ("{0}├── /{1}" -f $indent, $item.Name) | Out-File -Append -FilePath $OutputFile
          Get-DirectoryStructure -rootPath $item.FullName -indent ("{0}│   " -f $indent) -exemptFolders $exemptFolders
      }
      else {
          Write-Output ("{0}└── {1}" -f $indent, $item.Name) | Out-File -Append -FilePath $OutputFile
      }
  }
}

# Define the output file
$OutputFile = "directory_structure.txt"

# Define the exempt folders
$ExemptFolders = ".nuxt", ".vscode", "node_modules", "uploads", "assets", "static"



# Call the function with the current directory as the target
Get-DirectoryStructure -rootPath (Get-Location) -exemptFolders $ExemptFolders

