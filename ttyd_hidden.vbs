Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """C:\Users\halas\scoop\apps\ttyd\1.7.7\ttyd.exe"" -p 7681 ""C:\Program Files\PowerShell\7\pwsh.exe""", 0, False
