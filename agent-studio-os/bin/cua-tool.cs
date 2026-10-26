using System;
using System.IO;
using System.Text;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Threading;
using System.Text.RegularExpressions;

public class CuaTool {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)]
    public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public const int MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const int MOUSEEVENTF_LEFTUP = 0x0004;
    public const int MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const int MOUSEEVENTF_RIGHTUP = 0x0010;
    public const int MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    public const int MOUSEEVENTF_MIDDLEUP = 0x0040;

    public const byte VK_LWIN = 0x5B;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_SHIFT = 0x10;
    public const byte VK_MENU = 0x12; // Alt
    public const byte VK_TAB = 0x09;
    public const byte VK_ESCAPE = 0x1B;
    public const byte VK_RETURN = 0x0D;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static void AttachToUserDesktop() {
        try {
            IntPtr w0 = OpenWindowStation("winsta0", false, 0x037F);
            if (w0 != IntPtr.Zero) {
                SetProcessWindowStation(w0);
                IntPtr d0 = OpenDesktop("default", 0, false, 0x01FF);
                if (d0 != IntPtr.Zero) {
                    SetThreadDesktop(d0);
                }
            }
        } catch {}
    }

    /// <summary>
    /// Smoothly moves cursor from start to end with human-like visual glide
    /// </summary>
    public static void SmoothMove(int targetX, int targetY, int durationMs = 180) {
        Point start = Cursor.Position;
        int deltaX = targetX - start.X;
        int deltaY = targetY - start.Y;
        double distance = Math.Sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance < 5 || durationMs <= 0) {
            Cursor.Position = new Point(targetX, targetY);
            return;
        }

        int steps = Math.Max(8, Math.Min(30, (int)(durationMs / 10)));
        int sleepPerStep = Math.Max(4, durationMs / steps);

        for (int i = 1; i <= steps; i++) {
            // Cubic ease out: 1 - pow(1 - t, 3)
            double t = (double)i / steps;
            double progress = 1.0 - Math.Pow(1.0 - t, 3.0);
            int currentX = (int)(start.X + (deltaX * progress));
            int currentY = (int)(start.Y + (deltaY * progress));
            Cursor.Position = new Point(currentX, currentY);
            Thread.Sleep(sleepPerStep);
        }

        Cursor.Position = new Point(targetX, targetY);
    }

    public static void Main(string[] args) {
        AttachToUserDesktop();
        SetProcessDPIAware();

        if (args.Length == 0) {
            Console.WriteLine("{\"error\":\"No command specified\"}");
            return;
        }

        string cmd = args[0].ToLower();
        Stopwatch sw = Stopwatch.StartNew();

        try {
            if (cmd == "screenshot") {
                string outPath = args.Length > 1 ? args[1] : Path.Combine("public", "downloads", "latest-desktop.jpg");
                int markerX = args.Length > 2 ? int.Parse(args[2]) : -1;
                int markerY = args.Length > 3 ? int.Parse(args[3]) : -1;

                string outDir = Path.GetDirectoryName(outPath);
                if (!string.IsNullOrEmpty(outDir) && !Directory.Exists(outDir)) {
                    Directory.CreateDirectory(outDir);
                }

                Rectangle bounds = Screen.PrimaryScreen.Bounds;
                using (Bitmap bmp = new Bitmap(bounds.Width, bounds.Height)) {
                    using (Graphics g = Graphics.FromImage(bmp)) {
                        g.CopyFromScreen(0, 0, 0, 0, bounds.Size);

                        if (markerX >= 0 && markerY >= 0) {
                            using (Pen outerPen = new Pen(Color.FromArgb(239, 68, 68), 4))
                            using (SolidBrush innerBrush = new SolidBrush(Color.FromArgb(140, 239, 68, 68))) {
                                g.FillEllipse(innerBrush, markerX - 10, markerY - 10, 20, 20);
                                g.DrawEllipse(outerPen, markerX - 22, markerY - 22, 44, 44);
                            }
                        }
                    }

                    ImageCodecInfo jpegCodec = null;
                    foreach (ImageCodecInfo codec in ImageCodecInfo.GetImageEncoders()) {
                        if (codec.FormatID == ImageFormat.Jpeg.Guid) {
                            jpegCodec = codec;
                            break;
                        }
                    }

                    EncoderParameters encoderParams = new EncoderParameters(1);
                    encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 80L);

                    if (File.Exists(outPath)) {
                        try { File.Delete(outPath); } catch {}
                    }
                    bmp.Save(outPath, jpegCodec, encoderParams);
                }

                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"screenshot\",\"width\":{0},\"height\":{1},\"file\":\"{2}\",\"latency\":{3}}}",
                    bounds.Width, bounds.Height, outPath.Replace("\\", "/"), sw.ElapsedMilliseconds);
            }
            else if (cmd == "move" || cmd == "mouse_move") {
                if (args.Length < 3) {
                    Console.WriteLine("{\"error\":\"Usage: move <x> <y> [durationMs]\"}");
                    return;
                }
                int x = int.Parse(args[1]);
                int y = int.Parse(args[2]);
                int duration = args.Length > 3 ? int.Parse(args[3]) : 160;

                Point from = Cursor.Position;
                SmoothMove(x, y, duration);
                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"move\",\"from\":{{\"x\":{0},\"y\":{1}}},\"to\":{{\"x\":{2},\"y\":{3}}},\"latency\":{4}}}",
                    from.X, from.Y, x, y, sw.ElapsedMilliseconds);
            }
            else if (cmd == "click") {
                if (args.Length < 3) {
                    Console.WriteLine("{\"error\":\"Usage: click <x> <y> [smooth: true|false]\"}");
                    return;
                }
                int x = int.Parse(args[1]);
                int y = int.Parse(args[2]);
                bool smooth = args.Length <= 3 || !args[3].Equals("false", StringComparison.OrdinalIgnoreCase);

                if (smooth) {
                    SmoothMove(x, y, 150);
                } else {
                    Cursor.Position = new Point(x, y);
                }
                Thread.Sleep(30);
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                Thread.Sleep(45);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);

                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"click\",\"x\":{0},\"y\":{1},\"latency\":{2}}}",
                    x, y, sw.ElapsedMilliseconds);
            }
            else if (cmd == "double_click" || cmd == "doubleclick") {
                if (args.Length < 3) {
                    Console.WriteLine("{\"error\":\"Usage: double_click <x> <y>\"}");
                    return;
                }
                int x = int.Parse(args[1]);
                int y = int.Parse(args[2]);

                SmoothMove(x, y, 140);
                Thread.Sleep(30);
                // First click
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                Thread.Sleep(40);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                // Gap
                Thread.Sleep(80);
                // Second click
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                Thread.Sleep(40);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);

                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"double_click\",\"x\":{0},\"y\":{1},\"latency\":{2}}}",
                    x, y, sw.ElapsedMilliseconds);
            }
            else if (cmd == "right_click" || cmd == "rightclick") {
                if (args.Length < 3) {
                    Console.WriteLine("{\"error\":\"Usage: right_click <x> <y>\"}");
                    return;
                }
                int x = int.Parse(args[1]);
                int y = int.Parse(args[2]);

                SmoothMove(x, y, 140);
                Thread.Sleep(30);
                mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
                Thread.Sleep(45);
                mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);

                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"right_click\",\"x\":{0},\"y\":{1},\"latency\":{2}}}",
                    x, y, sw.ElapsedMilliseconds);
            }
            else if (cmd == "drag") {
                if (args.Length < 5) {
                    Console.WriteLine("{\"error\":\"Usage: drag <x1> <y1> <x2> <y2> [durationMs]\"}");
                    return;
                }
                int x1 = int.Parse(args[1]);
                int y1 = int.Parse(args[2]);
                int x2 = int.Parse(args[3]);
                int y2 = int.Parse(args[4]);
                int duration = args.Length > 5 ? int.Parse(args[5]) : 300;

                SmoothMove(x1, y1, 120);
                Thread.Sleep(40);
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                Thread.Sleep(60);
                SmoothMove(x2, y2, duration);
                Thread.Sleep(40);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);

                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"drag\",\"from\":{{\"x\":{0},\"y\":{1}}},\"to\":{{\"x\":{2},\"y\":{3}}},\"latency\":{4}}}",
                    x1, y1, x2, y2, sw.ElapsedMilliseconds);
            }
            else if (cmd == "type") {
                if (args.Length < 2) {
                    Console.WriteLine("{\"error\":\"Usage: type <text>\"}");
                    return;
                }
                string text = args[1];
                SendKeys.SendWait(text);

                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"type\",\"length\":{0},\"latency\":{1}}}",
                    text.Length, sw.ElapsedMilliseconds);
            }
            else if (cmd == "key") {
                if (args.Length < 2) {
                    Console.WriteLine("{\"error\":\"Usage: key <key>\"}");
                    return;
                }
                string key = args[1].ToLower();
                string mapped = key;
                if (key == "enter" || key == "return") mapped = "{ENTER}";
                else if (key == "tab") mapped = "{TAB}";
                else if (key == "esc" || key == "escape") mapped = "{ESC}";
                else if (key == "space") mapped = " ";
                else if (key == "backspace") mapped = "{BACKSPACE}";
                else if (key == "up") mapped = "{UP}";
                else if (key == "down") mapped = "{DOWN}";
                else if (key == "left") mapped = "{LEFT}";
                else if (key == "right") mapped = "{RIGHT}";
                else if (key == "ctrl+c") mapped = "^c";
                else if (key == "ctrl+v") mapped = "^v";
                else if (key == "ctrl+s") mapped = "^s";
                else if (key == "ctrl+a") mapped = "^a";
                else if (key == "ctrl+z") mapped = "^z";
                else if (key == "alt+f4") mapped = "%{F4}";

                SendKeys.SendWait(mapped);
                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"key\",\"key\":\"{0}\",\"latency\":{1}}}",
                    key, sw.ElapsedMilliseconds);
            }
            else if (cmd == "hotkey") {
                if (args.Length < 2) {
                    Console.WriteLine("{\"error\":\"Usage: hotkey <combo>\"}");
                    return;
                }
                string combo = args[1].ToLower().Trim();

                if (combo == "win+r") {
                    keybd_event(VK_LWIN, 0, 0, UIntPtr.Zero);
                    keybd_event(0x52, 0, 0, UIntPtr.Zero); // R
                    Thread.Sleep(60);
                    keybd_event(0x52, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                }
                else if (combo == "win+d") {
                    keybd_event(VK_LWIN, 0, 0, UIntPtr.Zero);
                    keybd_event(0x44, 0, 0, UIntPtr.Zero); // D
                    Thread.Sleep(60);
                    keybd_event(0x44, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                }
                else if (combo == "win+e") {
                    keybd_event(VK_LWIN, 0, 0, UIntPtr.Zero);
                    keybd_event(0x45, 0, 0, UIntPtr.Zero); // E
                    Thread.Sleep(60);
                    keybd_event(0x45, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                }
                else if (combo == "alt+tab") {
                    keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
                    keybd_event(VK_TAB, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(80);
                    keybd_event(VK_TAB, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                }
                else if (combo == "ctrl+shift+esc") {
                    keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
                    keybd_event(VK_SHIFT, 0, 0, UIntPtr.Zero);
                    keybd_event(VK_ESCAPE, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(60);
                    keybd_event(VK_ESCAPE, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                }
                else {
                    // Map common combo to SendKeys
                    string mapped = combo
                        .Replace("ctrl+", "^")
                        .Replace("alt+", "%")
                        .Replace("shift+", "+")
                        .Replace("enter", "{ENTER}")
                        .Replace("esc", "{ESC}")
                        .Replace("tab", "{TAB}");
                    SendKeys.SendWait(mapped);
                }

                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"hotkey\",\"combo\":\"{0}\",\"latency\":{1}}}",
                    combo, sw.ElapsedMilliseconds);
            }
            else if (cmd == "active_window" || cmd == "window") {
                IntPtr hwnd = GetForegroundWindow();
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hwnd, sb, sb.Capacity);
                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"active_window\",\"title\":\"{0}\",\"latency\":{1}}}",
                    sb.ToString().Replace("\"", "\\\""), sw.ElapsedMilliseconds);
            }
            else if (cmd == "launch") {
                if (args.Length < 2) {
                    Console.WriteLine("{\"error\":\"Usage: launch <target>\"}");
                    return;
                }
                string target = args[1].Trim();
                string targetLower = target.ToLower();

                // Strip navigation and launch prefixes
                string[] prefixes = new string[] {
                    "navigate to ", "navigate ", "browse to ", "browse ", "go to ", "goto ",
                    "open ", "launch ", "start ", "run ", "visit ", "take me to ", "head to "
                };
                foreach (string p in prefixes) {
                    if (targetLower.StartsWith(p)) {
                        target = target.Substring(p.Length).Trim();
                        targetLower = target.ToLower();
                        break;
                    }
                }

                // 1. YouTube Search pattern detection
                Match ytMatch = Regex.Match(target, @"(?:youtube\s+(?:and\s+)?search(?:\s+for)?|search\s+youtube(?:\s+for)?|youtube)\s+(.+)", RegexOptions.IgnoreCase);
                if (ytMatch.Success && !targetLower.Equals("youtube") && !targetLower.Equals("youtube.com")) {
                    string query = ytMatch.Groups[1].Value.Trim();
                    string ytUrl = "https://www.youtube.com/results?search_query=" + Uri.EscapeDataString(query);
                    Process.Start(ytUrl);
                    sw.Stop();
                    Console.WriteLine("{{\"success\":true,\"action\":\"launch\",\"target\":\"{0}\",\"url\":\"{1}\",\"latency\":{2}}}",
                        target.Replace("\"", "\\\""), ytUrl, sw.ElapsedMilliseconds);
                    return;
                }

                // 2. Google Search pattern detection
                Match gMatch = Regex.Match(target, @"(?:google\s+(?:and\s+)?search(?:\s+for)?|search\s+google(?:\s+for)?|google)\s+(.+)", RegexOptions.IgnoreCase);
                if (gMatch.Success && !targetLower.Equals("google") && !targetLower.Equals("google.com")) {
                    string query = gMatch.Groups[1].Value.Trim();
                    string gUrl = "https://www.google.com/search?q=" + Uri.EscapeDataString(query);
                    Process.Start(gUrl);
                    sw.Stop();
                    Console.WriteLine("{{\"success\":true,\"action\":\"launch\",\"target\":\"{0}\",\"url\":\"{1}\",\"latency\":{2}}}",
                        target.Replace("\"", "\\\""), gUrl, sw.ElapsedMilliseconds);
                    return;
                }

                // 3. Search query with 'on youtube' or 'on google'
                Match onYtMatch = Regex.Match(target, @"search\s+(?:for\s+)?(.+?)\s+on\s+youtube", RegexOptions.IgnoreCase);
                if (onYtMatch.Success) {
                    string query = onYtMatch.Groups[1].Value.Trim();
                    string ytUrl = "https://www.youtube.com/results?search_query=" + Uri.EscapeDataString(query);
                    Process.Start(ytUrl);
                    sw.Stop();
                    Console.WriteLine("{{\"success\":true,\"action\":\"launch\",\"target\":\"{0}\",\"url\":\"{1}\",\"latency\":{2}}}",
                        target.Replace("\"", "\\\""), ytUrl, sw.ElapsedMilliseconds);
                    return;
                }

                // App aliases and Web URLs
                if (targetLower == "calculator" || targetLower == "calc") {
                    Process.Start("calc");
                }
                else if (targetLower == "notepad") {
                    Process.Start("notepad");
                }
                else if (targetLower == "youtube" || targetLower == "youtube.com" || targetLower.Contains("youtube")) {
                    Process.Start("https://www.youtube.com");
                }
                else if (targetLower == "google" || targetLower == "google.com") {
                    Process.Start("https://www.google.com");
                }
                else if (targetLower == "github" || targetLower == "github.com") {
                    Process.Start("https://github.com");
                }
                else if (targetLower == "reddit" || targetLower == "reddit.com") {
                    Process.Start("https://www.reddit.com");
                }
                else if (targetLower == "twitter" || targetLower == "x.com" || targetLower == "x") {
                    Process.Start("https://x.com");
                }
                else if (targetLower == "chrome" || targetLower == "browser") {
                    try { Process.Start("chrome"); } catch { Process.Start("msedge"); }
                }
                else if (targetLower == "explorer" || targetLower == "files") {
                    Process.Start("explorer");
                }
                else if (targetLower == "terminal" || targetLower == "powershell") {
                    try { Process.Start("wt"); } catch { Process.Start("powershell"); }
                }
                else if (targetLower.StartsWith("http://") || targetLower.StartsWith("https://")) {
                    Process.Start(target);
                }
                else if (targetLower.EndsWith(".com") || targetLower.EndsWith(".org") || targetLower.EndsWith(".net") || targetLower.EndsWith(".io") || targetLower.EndsWith(".ai")) {
                    Process.Start("https://" + target);
                }
                else {
                    try {
                        if (!target.Contains(" ") || File.Exists(target)) {
                            Process.Start(target);
                        } else {
                            string searchUrl = "https://www.google.com/search?q=" + Uri.EscapeDataString(target);
                            Process.Start(searchUrl);
                        }
                    } catch {
                        string searchUrl = "https://www.google.com/search?q=" + Uri.EscapeDataString(target);
                        Process.Start(searchUrl);
                    }
                }

                sw.Stop();
                Console.WriteLine("{{\"success\":true,\"action\":\"launch\",\"target\":\"{0}\",\"latency\":{1}}}",
                    target.Replace("\"", "\\\""), sw.ElapsedMilliseconds);
            }
            else {
                Console.WriteLine("{{\"error\":\"Unknown command: {0}\"}}", cmd);
            }
        } catch (Exception ex) {
            sw.Stop();
            Console.WriteLine("{{\"success\":false,\"error\":\"{0}\",\"latency\":{1}}}",
                ex.ToString().Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " "), sw.ElapsedMilliseconds);
        }
    }
}
