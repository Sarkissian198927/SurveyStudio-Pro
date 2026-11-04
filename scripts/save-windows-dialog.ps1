param([Parameter(Mandatory=$true)][int]$AppProcessId,[Parameter(Mandatory=$true)][string]$FilePath)
$ErrorActionPreference='Stop'
# Use native dialog handles: UIAutomation can attribute an owned COM dialog to
# a different provider process and hide its filename edit from the app's tree.
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class SurveySaveDialog {
 public delegate bool EnumProc(IntPtr hwnd, IntPtr parameter);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
 [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr parameter);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd,StringBuilder text,int length);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int length);
 [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr hwnd);
 [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hwnd);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd,uint command);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr hwnd,uint message,IntPtr wparam,string value);
 [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd,uint message,IntPtr wparam,IntPtr lparam);
 static uint ProcessId(IntPtr hwnd){uint pid;GetWindowThreadProcessId(hwnd,out pid);return pid;}
 static string ClassName(IntPtr hwnd){var text=new StringBuilder(256);GetClassName(hwnd,text,text.Capacity);return text.ToString();}
 static string Title(IntPtr hwnd){var text=new StringBuilder(512);GetWindowText(hwnd,text,text.Capacity);return text.ToString();}
 static List<IntPtr> Windows(){var result=new List<IntPtr>();EnumWindows(delegate(IntPtr h,IntPtr p){result.Add(h);return true;},IntPtr.Zero);return result;}
 static List<IntPtr> Children(IntPtr parent){var result=new List<IntPtr>();EnumChildWindows(parent,delegate(IntPtr h,IntPtr p){result.Add(h);return true;},IntPtr.Zero);return result;}
 static bool OwnedBy(IntPtr hwnd,uint pid){return ProcessId(hwnd)==pid||ProcessId(GetWindow(hwnd,4))==pid;}
 public static bool TrySave(uint pid,string path){
  foreach(var window in Windows()){
   if(ClassName(window)!="#32770"||!OwnedBy(window,pid))continue;
   IntPtr edit=IntPtr.Zero,save=IntPtr.Zero;int priority=0;
   foreach(var child in Children(window)){
    string cls=ClassName(child);int id=GetDlgCtrlID(child);
    if(cls=="Button"&&id==1)save=child;
    if(cls=="Edit"){
     var parent=GetParent(child);int score=GetDlgCtrlID(parent)==1148?10:(id==1001?5:0);
     if(score>priority){edit=child;priority=score;}
    }
   }
   if(edit==IntPtr.Zero||save==IntPtr.Zero)continue;
   Console.WriteLine("Selected filename edit id="+GetDlgCtrlID(edit)+" parent="+GetDlgCtrlID(GetParent(edit))+" / "+ClassName(GetParent(edit))+" before="+Title(edit));
   SendMessage(edit,0x000C,IntPtr.Zero,path); // WM_SETTEXT
   Console.WriteLine("Filename edit after="+Title(edit));
   if(!PostMessage(save,0x00F5,IntPtr.Zero,IntPtr.Zero))throw new Exception("Native Save button could not be invoked.");
   return true;
  }
  return false;
 }
 public static string Describe(uint pid){
  var text=new StringBuilder();foreach(var window in Windows()){
   if(!OwnedBy(window,pid))continue;
   text.AppendLine("Window "+ClassName(window)+" / "+Title(window));
   foreach(var child in Children(window))text.AppendLine("  "+ClassName(child)+" id="+GetDlgCtrlID(child)+" / "+Title(child));
  }
  return text.ToString();
 }
}
'@
for($attempt=0;$attempt -lt 60;$attempt++){
 if([SurveySaveDialog]::TrySave([uint32]$AppProcessId,$FilePath)){Write-Output 'Native Save dialog completed.';exit 0}
 Start-Sleep -Milliseconds 250
}
Write-Output ([SurveySaveDialog]::Describe([uint32]$AppProcessId))
throw 'Native Save dialog for the installed app was not found.'
