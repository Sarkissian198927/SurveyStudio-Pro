param([Parameter(Mandatory=$true)][int]$AppProcessId,[Parameter(Mandatory=$true)][string]$FilePath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$processCondition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$AppProcessId)
$editCondition=[System.Windows.Automation.AndCondition]::new([System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit),[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1001'))
$saveCondition=[System.Windows.Automation.AndCondition]::new([System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button),[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1'))
for($attempt=0;$attempt -lt 60;$attempt++){
 $windows=$root.FindAll([System.Windows.Automation.TreeScope]::Children,$processCondition)
 foreach($window in $windows){
  $edit=$window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$editCondition)
  if($null -eq $edit){continue}
  $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($FilePath)
  $save=$window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$saveCondition)
  if($null -eq $save){continue}
  $save.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
  Write-Output 'Native Save dialog completed.'
  exit 0
 }
 Start-Sleep -Milliseconds 250
}
throw 'Native Save dialog for the installed app was not found.'
