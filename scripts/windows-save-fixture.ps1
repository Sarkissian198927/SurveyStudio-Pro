$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
$dialog=New-Object System.Windows.Forms.SaveFileDialog
$dialog.Title='SurveyStudio native Save fixture'
$dialog.Filter='CSV files (*.csv)|*.csv'
$dialog.DefaultExt='csv'
$dialog.FileName='fixture.csv'
try{
 if($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK){throw 'Save fixture was cancelled.'}
 [System.IO.File]::WriteAllText($env:SAVE_FIXTURE_RESULT,$dialog.FileName)
 [System.IO.File]::WriteAllText($dialog.FileName,'native-save-fixture',[System.Text.UTF8Encoding]::new($false))
}finally{$dialog.Dispose()}
