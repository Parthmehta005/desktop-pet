# Desktop Pet: reports the foreground window.
#
# Prints one compact JSON line whenever the foreground window changes:
#   {"process":"Spotify","title":"Spotify Premium","path":"C:\\...\\Spotify.exe","fullscreen":false}
# It needs no admin rights, makes no network connections, checks at most once a second,
# and exits when the pet that started it ($ParentPid, set by the pet) goes away.

$ErrorActionPreference = 'SilentlyContinue'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class DesktopPetForeground {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern IntPtr GetShellWindow();
  [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);
  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);

  public static bool IsFullscreen(IntPtr hWnd) {
    if (hWnd == IntPtr.Zero || hWnd == GetShellWindow() || hWnd == GetDesktopWindow()) return false;
    RECT r;
    if (!GetWindowRect(hWnd, out r)) return false;
    MONITORINFO mi = new MONITORINFO();
    mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
    if (!GetMonitorInfo(MonitorFromWindow(hWnd, 2), ref mi)) return false;
    return r.Left <= mi.rcMonitor.Left && r.Top <= mi.rcMonitor.Top
        && r.Right >= mi.rcMonitor.Right && r.Bottom >= mi.rcMonitor.Bottom;
  }

  public static string Title(IntPtr hWnd) {
    StringBuilder sb = new StringBuilder(512);
    GetWindowText(hWnd, sb, sb.Capacity);
    return sb.ToString();
  }
}
"@

$last = ''
while ($true) {
  if ($ParentPid -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }

  $hWnd = [DesktopPetForeground]::GetForegroundWindow()
  $info = @{ process = ''; title = ''; path = ''; fullscreen = $false }
  if ($hWnd -ne [IntPtr]::Zero) {
    $procId = 0
    [void][DesktopPetForeground]::GetWindowThreadProcessId($hWnd, [ref]$procId)
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
      $info.process = $proc.ProcessName
      if ($proc.Path) { $info.path = $proc.Path }
    }
    $info.title = [DesktopPetForeground]::Title($hWnd)
    $info.fullscreen = [DesktopPetForeground]::IsFullscreen($hWnd)
  }

  $json = $info | ConvertTo-Json -Compress
  if ($json -ne $last) {
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
    $last = $json
  }
  Start-Sleep -Milliseconds 1000
}
