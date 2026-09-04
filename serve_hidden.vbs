' Startuje statyczny serwer panto-os na :5500 w tle, bez okna konsoli.
' Powod: zadanie "PantoOS-Serve" wolalo powershell -WindowStyle Hidden, ale
' Windows Terminal (domyslny host konsoli w Win11) i tak pokazywal okno cmd,
' ktore npx tworzy dla "serve". wscript + Run(..., 0, False) chowa je naprawde.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "E:\Pliki\Projects\panto-os"
sh.Run "cmd /c """"C:\Users\halas\AppData\Roaming\npm\npx.cmd"" serve -p 5500 -s .""", 0, False
